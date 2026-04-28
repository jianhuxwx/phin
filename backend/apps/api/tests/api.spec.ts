import test from 'node:test';
import assert from 'node:assert/strict';

const TX_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BLOCK_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const WALLET = 'ccccccccccccccccccccccccccccccccccccccccccc';

class FakeRedis {
  constructor(
    private readonly values: Record<string, string | null>,
    private readonly lists: Record<string, string[]>
  ) {}

  async get(key: string) {
    return this.values[key] ?? null;
  }

  async lrange(key: string, start: number, end: number) {
    const list = this.lists[key] ?? [];
    return list.slice(start, end + 1);
  }

  disconnect() {}
}

class ThrowingRedis extends FakeRedis {
  constructor() {
    super({}, {});
  }

  override async get(_key: string) {
    throw new Error('ECONNRESET');
  }

  override async lrange(_key: string, _start: number, _end: number) {
    throw new Error('ECONNRESET');
  }
}

class FakeDb {
  async query(sql: string, params: unknown[]) {
    if (sql.includes('FROM arns_undernames') && !sql.includes('FROM arns_records')) {
      if (sql.includes('WHERE parent_name = $1')) {
        if (params[0] === 'alice') {
          return {
            rows: [
              {
                undername: 'docs',
                full_name: 'docs.alice',
                target_id: 'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
                target_kind: 'transaction',
                ttl_seconds: 300,
                updated_at: '2026-04-12T00:00:00.000Z',
                update_tx_id: 'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv'
              }
            ]
          };
        }

        return { rows: [] };
      }
    }

    if (sql.includes('WHERE undername.full_name = $1')) {
      if (params[0] === 'docs.alice') {
        return {
          rows: [
            {
              undername: 'docs',
              full_name: 'docs.alice',
              parent_name: 'alice',
              target_id: 'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
              target_kind: 'transaction',
              ttl_seconds: 300,
              updated_at: '2026-04-12T00:00:00.000Z',
              update_tx_id: 'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
              owner_address: WALLET,
              record_type: 'lease',
              resolved_url: 'alice.ar.io',
              controller_address: 'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
              process_id: 'ppppppppppppppppppppppppppppppppppppppppppp',
              purchase_currency: null
            }
          ]
        };
      }

      return { rows: [] };
    }

    if (sql.includes('WHERE name = $1')) {
      if (params[0] === 'alice') {
        return {
          rows: [
            {
              name: 'alice',
              owner_address: WALLET,
              transaction_id: TX_ID,
              registered_at: '2026-04-10T00:00:00.000Z',
              expires_at: '2026-05-10T00:00:00.000Z',
              record_type: 'lease',
              undername_limit: 10,
              resolved_url: 'alice.ar.io',
              controller_address: 'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
              process_id: 'ppppppppppppppppppppppppppppppppppppppppppp',
              target_id: TX_ID,
              target_kind: 'transaction',
              ttl_seconds: 900,
              registered_block_height: 100,
              last_updated_at: '2026-04-14T00:00:00.000Z',
              last_update_tx_id: 'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
              purchase_price: '15',
              purchase_currency: 'AR',
              undername_count: 2
            }
          ]
        };
      }

      if (params[0] === 'metalinks') {
        return {
          rows: [
            {
              name: 'metalinks',
              owner_address: WALLET,
              transaction_id: TX_ID,
              registered_at: '2026-04-10T00:00:00.000Z',
              expires_at: null,
              record_type: 'permanent',
              undername_limit: 0,
              resolved_url: 'metalinks.ar.io',
              controller_address: null,
              process_id: null,
              target_id: null,
              target_kind: null,
              ttl_seconds: null,
              registered_block_height: 100,
              last_updated_at: '2026-04-14T00:00:00.000Z',
              last_update_tx_id: TX_ID,
              purchase_price: null,
              purchase_currency: null,
              undername_count: 0
            }
          ]
        };
      }

      return { rows: [] };
    }

    if (sql.includes('COUNT(*)')) {
      return { rows: [{ count: 1 }] };
    }

    return {
      rows: [
        {
          name: 'alice',
          owner_address: WALLET,
          transaction_id: TX_ID,
          registered_at: '2026-04-10T00:00:00.000Z',
          expires_at: null,
          record_type: 'permanent',
          undername_limit: 10
        }
      ]
    };
  }

  async end() {}
}

class LegacySchemaDb extends FakeDb {
  override async query(sql: string, params: unknown[]) {
    if (sql.includes('resolved_url') || sql.includes('FROM arns_events') || sql.includes('FROM arns_undernames')) {
      const error = new Error(
        sql.includes('resolved_url')
          ? 'column "resolved_url" does not exist'
          : 'relation does not exist'
      ) as Error & { code?: string };
      error.code = sql.includes('resolved_url') ? '42703' : '42P01';
      throw error;
    }

    return await super.query(sql, params);
  }
}

const gateway = {
  async getLatestBlocksPage(page: number, limit: number) {
    const pages = [
      {
        id: BLOCK_ID,
        height: 100,
        timestamp: 1712700000,
        txCount: 3,
        weaveSize: '123',
        reward: '5'
      },
      {
        id: 'fffffffffffffffffffffffffffffffffffffffffff',
        height: 99,
        timestamp: 1712699900,
        txCount: 1,
        weaveSize: '120',
        reward: '4'
      }
    ];

    const start = (page - 1) * limit;
    const data = pages.slice(start, start + limit);

    return {
      data,
      hasNextPage: start + limit < pages.length,
      nextCursor: data.length ? `blocks-cursor-${page}` : null
    };
  },
  async getBlockById(id: string) {
    return {
      id,
      height: 100,
      timestamp: 1712700000,
      txCount: 3,
      weaveSize: '123',
      reward: '5',
      previousBlock: null
    };
  },
  async getBlockByHeight(height: number) {
    return {
      id: BLOCK_ID,
      height,
      timestamp: 1712700000,
      txCount: 3,
      weaveSize: '123',
      reward: '5',
      previousBlock: null
    };
  },
  async getBlockTransactions() {
    return {
      data: [
        {
          id: TX_ID,
          owner: { address: WALLET },
          recipient: null,
          quantity: { ar: '0' },
          fee: { ar: '0.01' },
          data: { size: 42, type: 'text/plain' },
          tags: [{ name: 'App-Name', value: 'Phin' }],
          block: { height: 100, timestamp: 1712700000 }
        }
      ],
      hasNextPage: false,
      nextCursor: null
    };
  },
  async resolveArnsName(name: string) {
    if (name === 'arlink' || name === 'metalinks') {
      return {
        name,
        processId: 'ppppppppppppppppppppppppppppppppppppppppppp',
        txId: 'lllllllllllllllllllllllllllllllllllllllllll',
        resolvedAt: 1712700100000,
        ttlSeconds: 900,
        undernameLimit: 25
      };
    }

    return null;
  },
  async getArnsProcessRecords(processId: string) {
    if (processId === 'ppppppppppppppppppppppppppppppppppppppppppp') {
      return [
        {
          undername: 'blog',
          targetId: 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
          ttlSeconds: 1200,
          ownerAddress: WALLET
        },
        {
          undername: 'docs',
          targetId: 'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
          ttlSeconds: 300,
          ownerAddress: WALLET
        }
      ];
    }

    return [];
  },
  async getTransaction(id: string) {
    if (id === 'ddddddddddddddddddddddddddddddddddddddddddd') {
      return null;
    }

    if (id === 'lllllllllllllllllllllllllllllllllllllllllll') {
      return {
        id,
        owner: { address: WALLET },
        recipient: null,
        quantity: { ar: '0' },
        fee: { ar: '0.01' },
        data: { size: 0, type: null },
        tags: [{ name: 'App-Name', value: 'ArNS' }],
        block: { id: BLOCK_ID, height: 100, timestamp: 1712700000 }
      };
    }

    return {
      id,
      owner: { address: WALLET },
      recipient: null,
      quantity: { ar: '0' },
      fee: { ar: '0.01' },
      data: { size: 42, type: 'text/plain' },
      tags: [{ name: 'File-Name', value: 'hello.txt' }],
      block: { id: BLOCK_ID, height: 100, timestamp: 1712700000 }
    };
  },
  async getTransactionsByOwner(_owner: string, _page: number, limit: number) {
    return {
      data: [
        {
          id: TX_ID,
          owner: { address: WALLET },
          recipient: null,
          quantity: { ar: '0' },
          fee: { ar: '0.01' },
          data: { size: 42, type: 'text/plain' },
          tags: [{ name: 'File-Name', value: 'hello.txt' }],
          block: { id: BLOCK_ID, height: 100, timestamp: 1712700000 }
        },
        {
          id: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          owner: { address: WALLET },
          recipient: null,
          quantity: { ar: '0' },
          fee: { ar: '0.01' },
          data: { size: 0, type: null },
          tags: [],
          block: null
        }
      ].slice(0, limit),
      hasNextPage: false,
      nextCursor: null
    };
  },
  async getWallet(address: string) {
    return {
      address,
      balance: '1000',
      lastTransactionId: TX_ID
    };
  },
  async getNetworkInfo() {
    return {
      height: 100,
      weaveSize: '123',
      peers: 25
    };
  },
  async getGatewayStatuses() {
    return [
      {
        url: 'https://gate.ar',
        alive: true,
        latencyMs: 100,
        blockHeight: 100,
        lastCheckedAt: 1712700050,
        consecutiveFailures: 0,
        status: 'healthy',
        error: null
      }
    ];
  }
};

async function loadBuildApp() {
  const { buildApp } = await import('../src/app');
  return buildApp;
}

async function createTestApp() {
  const diagnosticsChannel = await import('node:diagnostics_channel');
  const diagnostics = diagnosticsChannel.default as typeof diagnosticsChannel.default & {
    tracingChannel?: (name: string) => {
      traceSync<T>(fn: () => T): T;
      tracePromise<T>(fn: () => Promise<T>): Promise<T>;
      publish(message?: unknown): void;
      hasSubscribers: boolean;
    };
  };

  diagnostics.tracingChannel ??= () => ({
    traceSync<T>(fn: () => T): T {
      return fn();
    },
    async tracePromise<T>(fn: () => Promise<T>): Promise<T> {
      return await fn();
    },
    publish() {},
    hasSubscribers: false
  });

  const buildApp = await loadBuildApp();

  return await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis(
      {
        [`block:${BLOCK_ID}`]: JSON.stringify({
          id: BLOCK_ID,
          height: 100,
          timestamp: 1712700000,
          txCount: 3,
          weaveSize: '123',
          reward: '5',
          indexedAt: 1712700050,
          transactions: [
            {
              id: TX_ID,
              owner: { address: WALLET },
              recipient: null,
              quantity: { ar: '0' },
              fee: { ar: '0.01' },
              data: { size: 42, type: 'text/plain' },
              tags: [{ name: 'App-Name', value: 'Phin' }],
              block: { height: 100, timestamp: 1712700000 }
            }
          ]
        }),
        'network:stats': JSON.stringify({
          blockHeight: 100,
          weaveSize: '123',
          lastBlockTimestamp: 1712700000,
          approximateTPS: 1.5,
          lastBlockTxCount: 3,
          updatedAt: 1712700050
        }),
        'network:gateways': JSON.stringify([
          {
            url: 'https://gate.ar',
            alive: true,
            latencyMs: 100,
            blockHeight: 100,
            lastCheckedAt: 1712700050,
            consecutiveFailures: 0,
            status: 'healthy',
            error: null
          }
        ])
      },
      {
        'blocks:recent': [
          JSON.stringify({
            id: BLOCK_ID,
            height: 100,
            timestamp: 1712700000,
            txCount: 3,
            weaveSize: '123',
            reward: '5'
          })
        ]
      }
    ) as any,
    db: new FakeDb() as any,
    gateway: gateway as any
  });
}

test('lists cached recent blocks', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/blocks' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.data[0].id, BLOCK_ID);
  await app.close();
});

test('falls back to gateway blocks when cached recent blocks are only a partial page', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/blocks?limit=2' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.data.length, 2);
  assert.equal(payload.data[0].height, 100);
  assert.equal(payload.data[1].height, 99);
  assert.equal(payload.pagination.hasNextPage, false);
  await app.close();
});

test('falls back to gateway blocks when Redis cache reads fail', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new ThrowingRedis() as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({ method: 'GET', url: '/v1/blocks?limit=2' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.data.length, 2);
  assert.equal(payload.data[0].height, 100);
  assert.equal(payload.data[1].height, 99);
  await app.close();
});

test('paginates gateway blocks beyond page one', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/blocks?page=2&limit=1' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.data[0].height, 99);
  assert.equal(payload.data[0].txCount, 1);
  assert.equal(payload.data[0].weaveSize, '120');
  assert.equal(payload.data[0].reward, '4');
  assert.equal(payload.pagination.nextCursor, 'blocks-cursor-2');
  await app.close();
});

test('reads block by height through fallback gateway', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/blocks/height/100' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().height, 100);
  await app.close();
});

test('ignores stale cached block detail with zero reward and weave size', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis(
      {
        'block:height:100': JSON.stringify({
          id: BLOCK_ID,
          height: 100,
          timestamp: 1712700000,
          txCount: 3,
          weaveSize: '0',
          reward: '0',
          indexedAt: 1712700050,
          transactions: []
        })
      },
      {}
    ) as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({ method: 'GET', url: '/v1/blocks/height/100' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().weaveSize, '123');
  assert.equal(response.json().reward, '5');
  await app.close();
});

test('falls back to gateway block transactions when cached block omits them', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis(
      {
        [`block:${BLOCK_ID}`]: JSON.stringify({
          id: BLOCK_ID,
          height: 100,
          timestamp: 1712700000,
          txCount: 3,
          weaveSize: '123',
          reward: '5',
          indexedAt: 1712700050,
          transactions: []
        })
      },
      {}
    ) as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({ method: 'GET', url: `/v1/blocks/${BLOCK_ID}/transactions` });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].id, TX_ID);
  await app.close();
});

test('paginates cached block transactions', async () => {
  const buildApp = await loadBuildApp();
  const pagedTxs = Array.from({ length: 25 }, (_, index) => ({
    id: `tx-${index}`,
    owner: { address: WALLET },
    recipient: null,
    quantity: { ar: '0' },
    fee: { ar: '0.01' },
    data: { size: index + 1, type: 'text/plain' },
    tags: [],
    block: { height: 100, timestamp: 1712700000 }
  }));

  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis(
      {
        [`block:${BLOCK_ID}`]: JSON.stringify({
          id: BLOCK_ID,
          height: 100,
          timestamp: 1712700000,
          txCount: pagedTxs.length,
          weaveSize: '123',
          reward: '5',
          indexedAt: 1712700050,
          transactions: pagedTxs
        })
      },
      {}
    ) as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({
    method: 'GET',
    url: `/v1/blocks/${BLOCK_ID}/transactions?page=2&limit=20`
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.pagination.page, 2);
  assert.equal(payload.data.length, 5);
  assert.equal(payload.data[0].id, 'tx-20');
  assert.equal(payload.pagination.hasNextPage, false);
  await app.close();
});

test('accepts long Arweave block ids on block detail routes', async () => {
  const app = await createTestApp();
  const longBlockId = 'WZuQo33XqnuA3iFsHFwl0rU4azwTZuVgTCoFcoyKdN4y1cCRKGu1jxF8gkb0cMPS';

  const detailResponse = await app.inject({
    method: 'GET',
    url: `/v1/blocks/${longBlockId}`
  });
  assert.equal(detailResponse.statusCode, 200);

  const txResponse = await app.inject({
    method: 'GET',
    url: `/v1/blocks/${longBlockId}/transactions`
  });
  assert.equal(txResponse.statusCode, 200);
  await app.close();
});

test('returns cached network stats', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/network/stats' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().approximateTPS, 1.5);
  await app.close();
});

test('ignores stale cached network stats with zero weave size', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis(
      {
        'network:stats': JSON.stringify({
          blockHeight: 100,
          weaveSize: '0',
          lastBlockTimestamp: 1712700000,
          approximateTPS: 0,
          lastBlockTxCount: 0,
          updatedAt: 1712700050
        })
      },
      {}
    ) as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });
  const response = await app.inject({ method: 'GET', url: '/v1/network/stats' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().weaveSize, '123');
  await app.close();
});

test('falls back to live network stats when Redis cache reads fail', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new ThrowingRedis() as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({ method: 'GET', url: '/v1/network/stats' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.blockHeight, 100);
  assert.equal(payload.weaveSize, '123');
  await app.close();
});

test('falls back to live gateway statuses when cache is empty', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis({}, {}) as any,
    db: new FakeDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });
  const response = await app.inject({ method: 'GET', url: '/v1/network/gateways' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload[0].url, 'https://gate.ar');
  await app.close();
});

test('filters wallet files to data-bearing transactions', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: `/v1/wallets/${WALLET}/files` });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].dataSize, 42);
  await app.close();
});

test('returns ArNS detail from Postgres', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/arns/alice' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.name, 'alice');
  assert.equal(payload.resolvedUrl, 'alice.ar.io');
  assert.equal(payload.controllerAddress, 'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii');
  assert.equal(payload.targetId, TX_ID);
  assert.equal(payload.ttlSeconds, 900);
  assert.equal(payload.undernameCount, 2);
  assert.equal(payload.undernames.length, 2);
  assert.equal(payload.undernames[1].fullName, 'docs.alice');
  await app.close();
});

test('returns indexed ArNS undername detail from Postgres', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/arns/docs.alice' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.name, 'docs.alice');
  assert.equal(payload.recordType, 'undername');
  assert.equal(payload.targetId, 'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu');
  assert.equal(payload.ttlSeconds, 300);
  await app.close();
});

test('merges live ANT undernames when indexed list is incomplete', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/arns/alice' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.undernameCount, 2);
  assert.equal(payload.undernames.length, 2);
  assert.equal(payload.undernames[0].undername, 'blog');
  assert.equal(payload.undernames[0].fullName, 'blog.alice');
  assert.equal(payload.undernames[1].undername, 'docs');
  await app.close();
});

test('hydrates live ANT undernames when indexed ArNS record lacks a process id', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/arns/metalinks' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.name, 'metalinks');
  assert.equal(payload.processId, 'ppppppppppppppppppppppppppppppppppppppppppp');
  assert.equal(payload.undernameLimit, 25);
  assert.equal(payload.undernameCount, 2);
  assert.equal(payload.undernames[0].fullName, 'blog.metalinks');
  await app.close();
});

test('returns live ANT undername detail when dotted ArNS name is not indexed', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/arns/blog.metalinks' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.name, 'blog.metalinks');
  assert.equal(payload.recordType, 'undername');
  assert.equal(payload.resolvedUrl, 'blog_metalinks.ar.io');
  assert.equal(payload.processId, 'ppppppppppppppppppppppppppppppppppppppppppp');
  assert.equal(payload.targetId, 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm');
  assert.equal(payload.ttlSeconds, 1200);
  await app.close();
});

test('falls back to legacy ArNS schema when 4.3 columns are missing', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis({}, {}) as any,
    db: new LegacySchemaDb() as any,
    gateway: gateway as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({ method: 'GET', url: '/v1/arns/alice' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.name, 'alice');
  assert.equal(payload.resolvedUrl, 'alice.ar.io');
  assert.equal(payload.targetId, TX_ID);
  assert.equal(payload.undernames.length, 0);
  await app.close();
});

test('falls back to live gateway ArNS resolution when Postgres misses the name', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/v1/arns/arlink' });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.name, 'arlink');
  assert.equal(payload.transactionId, 'lllllllllllllllllllllllllllllllllllllllllll');
  assert.equal(payload.ownerAddress, WALLET);
  assert.equal(payload.recordType, 'permanent');
  assert.equal(payload.undernameLimit, 25);
  assert.equal(payload.processId, 'ppppppppppppppppppppppppppppppppppppppppppp');
  assert.equal(payload.ttlSeconds, 900);
  await app.close();
});

test('filters ArNS list by both q and legacy search query params', async () => {
  const app = await createTestApp();

  const qResponse = await app.inject({ method: 'GET', url: '/v1/arns?q=alice' });
  assert.equal(qResponse.statusCode, 200);
  assert.equal(qResponse.json().data.length, 1);
  assert.equal(qResponse.json().data[0].name, 'alice');

  const legacySearchResponse = await app.inject({ method: 'GET', url: '/v1/arns?search=alice' });
  assert.equal(legacySearchResponse.statusCode, 200);
  assert.equal(legacySearchResponse.json().data.length, 1);
  assert.equal(legacySearchResponse.json().data[0].name, 'alice');

  await app.close();
});

test('resolves tx search and rejects keyword search as unsupported', async () => {
  const app = await createTestApp();
  const txResponse = await app.inject({
    method: 'GET',
    url: `/v1/search?q=${TX_ID}`
  });
  assert.equal(txResponse.statusCode, 200);
  assert.equal(txResponse.json().type, 'transaction');

  const keywordResponse = await app.inject({
    method: 'GET',
    url: '/v1/search?q=hello%20world'
  });
  assert.equal(keywordResponse.statusCode, 200);
  assert.equal(keywordResponse.json().type, 'unsupported');
  await app.close();
});

test('resolves wallet addresses as wallets when no transaction exists for the id', async () => {
  const buildApp = await loadBuildApp();
  const app = await buildApp({
    fastify: { logger: false },
    redis: new FakeRedis({}, {}) as any,
    db: new FakeDb() as any,
    gateway: {
      ...gateway,
      async getTransaction(id: string) {
        if (id === WALLET) {
          return null;
        }

        return await gateway.getTransaction(id);
      }
    } as any,
    enableSwagger: false,
    enableWebsocket: false
  });

  const response = await app.inject({
    method: 'GET',
    url: `/v1/search?q=${WALLET}`
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().type, 'wallet');
  assert.equal(response.json().target, WALLET);
  await app.close();
});

test('resolves long base64url hashes as blocks before ArNS', async () => {
  const app = await createTestApp();
  const longBlockId = 'WZuQo33XqnuA3iFsHFwl0rU4azwTZuVgTCoFcoyKdN4y1cCRKGu1jxF8gkb0cMPS';
  const response = await app.inject({
    method: 'GET',
    url: `/v1/search?q=${longBlockId}`
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().type, 'block');
  assert.equal(response.json().target, longBlockId);
  await app.close();
});

test('resolves block heights to block routes by height', async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: 'GET',
    url: '/v1/search?q=100'
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().type, 'block');
  assert.equal(response.json().target, '100');
  await app.close();
});

test('validates tx ids and returns 404 for missing ArNS names', async () => {
  const app = await createTestApp();
  const badTxResponse = await app.inject({
    method: 'GET',
    url: '/v1/transactions/not-a-txid'
  });
  assert.equal(badTxResponse.statusCode, 400);

  const missingArnsResponse = await app.inject({
    method: 'GET',
    url: '/v1/arns/unknown'
  });
  assert.equal(missingArnsResponse.statusCode, 404);
  await app.close();
});
