import assert from 'node:assert/strict';

import dotenv from 'dotenv';

import { createRedisClient, PubSubChannels } from 'phin-cache';
import type Redis from 'ioredis';

import {
  publishGatewayStatus,
  publishNewBlock,
  publishNewTransaction,
  publishStatsUpdate
} from '../src/publisher';
import type { GatewayStatus } from 'phin-types';

dotenv.config();

type PublishedMessage = {
  channel: string;
  message: string;
  json: any;
};

class MockRedis {
  public published: PublishedMessage[] = [];

  async publish(channel: string, message: string): Promise<number> {
    this.published.push({ channel, message, json: JSON.parse(message) });
    return 1;
  }

  disconnect(): void {
    // no-op
  }
}

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        console.log(`[Publisher:test] PASS ${name}`);
      },
      (err) => {
        console.error(`[Publisher:test] FAIL ${name}`);
        console.error(err);
        throw err;
      }
    );
}

function makeTransaction(id: string, size: number) {
  return {
    id,
    data: { size },
    owner: { address: 'owner' },
    fee: { ar: '0' },
    quantity: { ar: '0' },
    tags: [],
    block: { height: 1, timestamp: Date.now() }
  };
}

async function runUnitTests() {
  await test('publishNewBlock serializes recent transactions capped at five', async () => {
    const mock = new MockRedis();
    const block = {
      height: 100,
      id: 'block-id',
      timestamp: 12345678,
      txCount: 10,
      weaveSizeDelta: 1024,
      totalWeaveSize: 10_000,
      reward: '0.5',
      miner: 'miner-address'
    };
    const transactions = Array.from({ length: 8 }).map((_, idx) =>
      makeTransaction(`tx-${idx}`, idx + 1)
    );

    await publishNewBlock(mock as unknown as Redis, block, transactions);

    assert.equal(mock.published.length, 1);
    const payload = mock.published[0];
    assert.equal(payload.channel, PubSubChannels.NEW_BLOCK);
    assert.equal(payload.json.data.recentTransactions.length, 5);
    assert.equal(payload.json.data.txCount, 10);
  });

  await test('publishStatsUpdate forwards stats payload', async () => {
    const mock = new MockRedis();
    const stats = {
      blockHeight: 10,
      weaveSize: 2000,
      approximateTPS: 1.2,
      lastBlockTimestamp: Date.now()
    };

    await publishStatsUpdate(mock as unknown as Redis, stats);

    assert.equal(mock.published.length, 1);
    const payload = mock.published[0];
    assert.equal(payload.channel, PubSubChannels.STATS_UPDATE);
    assert.equal(payload.json.data.blockHeight, stats.blockHeight);
  });

  await test('publishNewTransaction skips zero-byte payloads', async () => {
    const mock = new MockRedis();
    const tx = makeTransaction('tx-1', 0);

    await publishNewTransaction(mock as unknown as Redis, tx);

    assert.equal(mock.published.length, 0);
  });

  await test('publishNewTransaction forwards content-bearing payloads', async () => {
    const mock = new MockRedis();
    const tx = makeTransaction('tx-2', 1024);

    await publishNewTransaction(mock as unknown as Redis, tx);

    assert.equal(mock.published.length, 1);
    const payload = mock.published[0];
    assert.equal(payload.channel, PubSubChannels.NEW_TRANSACTION);
    assert.equal(payload.json.data.id, tx.id);
  });
}

async function fetchGraphql<T>(
  gatewayUrl: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`[Publisher:test] Gateway error (${response.status}): ${text}`);
  }

  const json = text ? JSON.parse(text) : {};

  if (json.errors?.length) {
    throw new Error(`[Publisher:test] Gateway GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

async function loadLiveBlockSample(gatewayUrl: string) {
  const blockQuery = /* GraphQL */ `
    query GetLatestBlock {
      blocks(first: 1, sort: HEIGHT_DESC) {
        edges {
          node {
            id
            height
            timestamp
          }
        }
      }
    }
  `;

  const blockData = await fetchGraphql<{
    blocks: { edges: Array<{ node: any }> };
  }>(gatewayUrl, blockQuery);

  const blockNode = blockData.blocks.edges[0]?.node;
  if (!blockNode) {
    throw new Error('[Publisher:test] Failed to load latest block information');
  }

  const txQuery = /* GraphQL */ `
    query GetBlockTransactions($height: Int!) {
      transactions(first: 50, block: { min: $height, max: $height }, sort: HEIGHT_ASC) {
        edges {
          node {
            id
            owner {
              address
            }
            fee {
              ar
            }
            quantity {
              ar
            }
            data {
              size
              type
            }
            tags {
              name
              value
            }
          }
        }
      }
    }
  `;

  const txData = await fetchGraphql<{
    transactions: { edges: Array<{ node: any }> } | null;
  }>(gatewayUrl, txQuery, { height: blockNode.height });

  const transactionEdges = txData.transactions?.edges ?? [];
  const transactions = transactionEdges.map(({ node }) => ({
    ...node,
    data: {
      size: typeof node.data?.size === 'number' ? node.data.size : Number(node.data?.size) || 0,
      type: node.data?.type ?? null
    }
  }));

  const enrichedBlock = {
    ...blockNode,
    txCount: transactions.length,
    weaveSizeDelta: 0,
    totalWeaveSize: 0,
    reward: '0',
    miner: 'unknown'
  };

  return { block: enrichedBlock, transactions };
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  pollInterval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  throw new Error('[Publisher:test] Timed out waiting for Redis pub/sub messages');
}

async function runLivePublisherTest(): Promise<void> {
  if (process.env.RUN_PUBLISHER_LIVE_TEST !== '1') {
    console.log(
      '[Publisher:test] Skipping live publisher test (set RUN_PUBLISHER_LIVE_TEST=1 to enable)'
    );
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  const gatewayUrl = process.env.GATE_AR_URL;

  if (!redisUrl) {
    console.warn(
      '[Publisher:test] RUN_PUBLISHER_LIVE_TEST=1 but REDIS_URL is not set; skipping live publisher test'
    );
    return;
  }
  if (!gatewayUrl) {
    console.warn(
      '[Publisher:test] RUN_PUBLISHER_LIVE_TEST=1 but GATE_AR_URL is not set; skipping live publisher test'
    );
    return;
  }

  console.log(
    `[Publisher:test] Running live publisher test against gateway=${gatewayUrl} redis=${redisUrl}`
  );

  const publisher = createRedisClient(redisUrl);
  const subscriber = createRedisClient(redisUrl);

  const channels = [
    PubSubChannels.NEW_BLOCK,
    PubSubChannels.STATS_UPDATE,
    PubSubChannels.NEW_TRANSACTION,
    PubSubChannels.GATEWAY_STATUS
  ];

  const received = new Map<string, unknown>();
  subscriber.on('message', (channel, message) => {
    try {
      received.set(channel, JSON.parse(message));
    } catch (err) {
      received.set(channel, { raw: message, error: err });
    }
  });

  const subscribedChannels = [...channels];
  await subscriber.subscribe(...subscribedChannels);

  try {
    const { block, transactions } = await loadLiveBlockSample(gatewayUrl);
    const statsPayload = {
      blockHeight: block.height,
      weaveSize: Number(block.totalWeaveSize) || 0,
      approximateTPS: block.txCount ?? 0,
      lastBlockTimestamp: block.timestamp
    };

    const statusPayload: GatewayStatus[] = [
      {
        url: gatewayUrl,
        alive: true,
        latencyMs: 0,
        blockHeight: block.height,
        lastCheckedAt: Date.now(),
        consecutiveFailures: 0,
        status: 'healthy',
        error: null
      }
    ];

    await publishNewBlock(publisher, block, transactions);
    await publishStatsUpdate(publisher, statsPayload);

    const firstRichTx =
      transactions.find((tx) => typeof tx?.data?.size === 'number' && tx.data.size > 0) ?? null;
    if (firstRichTx) {
      await publishNewTransaction(publisher, firstRichTx);
    } else {
      console.warn(
        '[Publisher:test] Live block sample had no transactions with data payload; skipping publishNewTransaction verification'
      );
      const idx = channels.indexOf(PubSubChannels.NEW_TRANSACTION);
      if (idx >= 0) {
        channels.splice(idx, 1);
      }
    }

    await publishGatewayStatus(publisher, statusPayload);

    await waitForCondition(
      () => channels.every((channel) => received.has(channel)),
      15_000
    );

    console.log('[Publisher:test] Live publisher payload snapshot:', Object.fromEntries(received));
  } finally {
    await subscriber.unsubscribe(...subscribedChannels).catch(() => undefined);
    publisher.disconnect();
    subscriber.disconnect();
  }
}

async function main() {
  try {
    await runUnitTests();
    await runLivePublisherTest();
    console.log('[Publisher:test] All publisher tests completed');
  } catch (err) {
    console.error('[Publisher:test] Publisher test suite failed', err);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[Publisher:test] Unhandled error in publisher tests', err);
  process.exitCode = 1;
});
