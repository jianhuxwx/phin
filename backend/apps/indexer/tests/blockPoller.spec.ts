import assert from 'node:assert/strict';
import {
  appendToWindow,
  computeApproximateTPS,
  createGatewayHttpClient,
  getLatestBlockInfo,
  getBlockInfoByHeight,
  cacheBlock,
  cacheTransactions,
  cacheNetworkStats,
  persistLastKnownHeight,
  buildBlockCachePayload,
  type LatestBlockInfo,
  type ArweaveTransactionNode,
  type NetworkStatsPayload
} from '../src/jobs/blockPoller';
import { createRedisClient, CacheKeys } from 'phin-cache';

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        console.log(`[BlockPoller:test] PASS ${name}`);
      },
      (err) => {
        console.error(`[BlockPoller:test] FAIL ${name}`);
        console.error(err);
        throw err;
      }
    );
}

async function runUnitTests() {
  await test('appendToWindow grows until maxLength', () => {
    const orig: number[] = [];
    const result1 = appendToWindow(orig, 1, 3);
    assert.deepEqual(result1, [1]);
    assert.deepEqual(orig, []);

    const result2 = appendToWindow(result1, 2, 3);
    assert.deepEqual(result2, [1, 2]);

    const result3 = appendToWindow(result2, 3, 3);
    assert.deepEqual(result3, [1, 2, 3]);
  });

  await test('appendToWindow drops oldest when exceeding maxLength', () => {
    const window = [1, 2, 3];
    const result = appendToWindow(window, 4, 3);
    assert.deepEqual(result, [2, 3, 4]);
    assert.deepEqual(window, [1, 2, 3]);
  });

  await test('appendToWindow with non-positive maxLength always returns empty', () => {
    const window = [1, 2, 3];
    assert.deepEqual(appendToWindow(window, 4, 0), []);
    assert.deepEqual(appendToWindow(window, 4, -5), []);
  });

  await test('computeApproximateTPS returns 0 for insufficient data points or mismatch', () => {
    assert.equal(computeApproximateTPS([], []), 0);
    assert.equal(computeApproximateTPS([1], [10]), 0);
    assert.equal(computeApproximateTPS([1, 2], [10]), 0);
  });

  await test('computeApproximateTPS returns 0 for non-positive time delta', () => {
    assert.equal(computeApproximateTPS([10, 10], [5, 5]), 0);
    assert.equal(computeApproximateTPS([20, 10], [5, 5]), 0);
  });

  await test('computeApproximateTPS computes correct TPS for valid window', () => {
    const timestamps = [10, 20, 30];
    const txCounts = [5, 10, 15]; // total = 30, delta = 20 -> TPS = 1.5
    const tps = computeApproximateTPS(timestamps, txCounts);
    assert.ok(Math.abs(tps - 1.5) < 1e-9);
  });

  await test('getBlockInfoByHeight uses blocks query shape supported by gateway', async () => {
    let capturedQuery = '';
    let capturedVariables: Record<string, unknown> | undefined;

    const client = {
      async query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
        capturedQuery = gql;
        capturedVariables = variables;

        return {
          blocks: {
            edges: [
              {
                node: {
                  id: 'block-123',
                  height: 123,
                  timestamp: 1712700000,
                  previous: 'block-122'
                }
              }
            ]
          }
        } as T;
      }
    };

    const info = await getBlockInfoByHeight(client, 123);

    assert.match(capturedQuery, /blocks\(first: 1, sort: HEIGHT_DESC, height: \{ min: \$height, max: \$height \}\)/);
    assert.deepEqual(capturedVariables, { height: 123 });
    assert.equal(info.id, 'block-123');
    assert.equal(info.height, 123);
    assert.equal(info.timestamp, 1712700000);
    assert.equal(info.previousBlock, 'block-122');
    assert.equal(info.weaveSize, '0');
    assert.equal(info.reward, '0');
  });
}

async function runIntegrationTest() {
  const gateArUrl =
    process.env.GATE_AR_URL || process.env.VITE_GATE_AR_URL || 'https://gate.ar';

  console.log(
    `[BlockPoller:test] Running live latest-block fetch against ${gateArUrl} (set GATE_AR_URL to override)`
  );

  await test('getLatestBlockInfo fetches a block from live gateway', async () => {
    const client = createGatewayHttpClient(gateArUrl);
    const info = await getLatestBlockInfo(client);

    assert.ok(typeof info.height === 'number' && info.height >= 0);
    assert.ok(typeof info.id === 'string' && info.id.length > 0);
    assert.ok(typeof info.timestamp === 'number' && info.timestamp > 0);

    console.log('[BlockPoller:test] Latest block info snapshot:', {
      height: info.height,
      id: info.id,
      timestamp: info.timestamp
    });
  });
}

async function main() {
  try {
    await runUnitTests();

    // Run the integration test only if explicitly requested via env,
    // to avoid failures in environments without network access.
    if (process.env.RUN_LIVE_GATE_TEST === '1') {
      await runIntegrationTest();
    } else {
      console.log(
        '[BlockPoller:test] Skipping live gateway test (set RUN_LIVE_GATE_TEST=1 to enable)'
      );
    }

    // Optional Redis integration test: writes a synthetic block and stats into Redis and
    // verifies the expected keys are present. Disabled by default.
    if (process.env.RUN_REDIS_WRITE_TEST === '1') {
      const redisUrl =
        process.env.REDIS_URL || 'redis://75.119.146.45:32768';
      console.log(
        `[BlockPoller:test] Running Redis integration test against ${redisUrl}`
      );

      const redis = createRedisClient(redisUrl);

      await test('cache helpers write expected keys to Redis', async () => {
        const nowMs = Date.now();
        const nowSec = Math.floor(nowMs / 1000);

        const block: LatestBlockInfo = {
          height: nowSec, // synthetic but unique-ish
          id: `test-block-${nowMs}`,
          timestamp: nowSec,
          weaveSize: '0',
          blockSize: '0',
          txCount: 2,
          reward: '0',
          previousBlock: 'test-prev'
        };

        const transactions: ArweaveTransactionNode[] = [
          {
            id: `test-tx-${nowMs}-1`,
            anchor: 'test-anchor-1',
            signature: 'test-signature-1',
            owner: { address: 'test-owner-1' },
            fee: { ar: '0.0001' },
            quantity: { ar: '0' },
            data: { size: 1234, type: 'text/plain' },
            tags: [
              { name: 'App-Name', value: 'phin-test' },
              { name: 'File-Name', value: 'example.txt' }
            ],
            block: { height: block.height, timestamp: block.timestamp }
          },
          {
            id: `test-tx-${nowMs}-2`,
            anchor: 'test-anchor-2',
            signature: 'test-signature-2',
            owner: { address: 'test-owner-2' },
            fee: { ar: '0.0002' },
            quantity: { ar: '0.5' },
            data: { size: 0, type: null },
            tags: [],
            block: { height: block.height, timestamp: block.timestamp }
          }
        ];

        const blockPayload = buildBlockCachePayload(block, transactions);

        const stats: NetworkStatsPayload = {
          blockHeight: block.height,
          weaveSize: block.weaveSize,
          lastBlockTimestamp: block.timestamp,
          approximateTPS: 0.5,
          lastBlockTxCount: block.txCount,
          updatedAt: nowMs
        };

        await cacheBlock(redis, blockPayload);
        await cacheTransactions(redis, transactions, block.height);
        await cacheNetworkStats(redis, stats);
        await persistLastKnownHeight(redis, block.height);

        const blockKey = CacheKeys.blockByHeight(block.height);
        const statsKey = CacheKeys.networkStats();

        const storedBlock = await redis.get(blockKey);
        const storedStats = await redis.get(statsKey);
        const lastHeight = await redis.get('indexer:lastHeight');
        const recentBlocks = await redis.lrange('blocks:recent', 0, 0);
        const recentTxs = await redis.lrange('transactions:recent', 0, 10);

        console.log('[BlockPoller:test] Redis verification snapshot:', {
          blockKey,
          statsKey,
          blockByHeightExists: !!storedBlock,
          statsExists: !!storedStats,
          lastHeight,
          recentBlocksCount: recentBlocks.length,
          recentTxsCount: recentTxs.length
        });

        if (!storedBlock) {
          throw new Error(
            'block:height key not found in Redis after cacheBlock'
          );
        }
        if (!storedStats) {
          throw new Error(
            'network:stats key not found in Redis after cacheNetworkStats'
          );
        }
        if (!lastHeight) {
          throw new Error(
            'indexer:lastHeight key not found in Redis after persistLastKnownHeight'
          );
        }
      });

      redis.disconnect();
    } else {
      console.log(
        '[BlockPoller:test] Skipping Redis integration test (set RUN_REDIS_WRITE_TEST=1 to enable)'
      );
    }

    console.log('[BlockPoller:test] All tests completed');
  } catch (err) {
    console.error('[BlockPoller:test] Test suite failed');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[BlockPoller:test] Unhandled error in test runner', err);
  process.exitCode = 1;
});
