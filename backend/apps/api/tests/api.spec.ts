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

class FakeDb {
  async query(sql: string, params: unknown[]) {
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ count: 1 }] };
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
              expires_at: null,
              record_type: 'Register',
              undername_limit: 10
            }
          ]
        };
      }

      return { rows: [] };
    }

    return {
      rows: [
        {
          name: 'alice',
          owner_address: WALLET,
          transaction_id: TX_ID,
          registered_at: '2026-04-10T00:00:00.000Z',
          expires_at: null,
          record_type: 'Register',
          undername_limit: 10
        }
      ]
    };
  }

  async end() {}
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
  async getTransaction(id: string) {
    if (id === 'ddddddddddddddddddddddddddddddddddddddddddd') {
      return null;
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
  assert.equal(response.json().name, 'alice');
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
