"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const blockPoller_1 = require("./blockPoller");
const phin_cache_1 = require("phin-cache");
function test(name, fn) {
    return Promise.resolve()
        .then(fn)
        .then(() => {
        console.log(`[BlockPoller:test] PASS ${name}`);
    }, (err) => {
        console.error(`[BlockPoller:test] FAIL ${name}`);
        console.error(err);
        throw err;
    });
}
async function runUnitTests() {
    await test('appendToWindow grows until maxLength', () => {
        const orig = [];
        const result1 = (0, blockPoller_1.appendToWindow)(orig, 1, 3);
        strict_1.default.deepEqual(result1, [1]);
        strict_1.default.deepEqual(orig, []);
        const result2 = (0, blockPoller_1.appendToWindow)(result1, 2, 3);
        strict_1.default.deepEqual(result2, [1, 2]);
        const result3 = (0, blockPoller_1.appendToWindow)(result2, 3, 3);
        strict_1.default.deepEqual(result3, [1, 2, 3]);
    });
    await test('appendToWindow drops oldest when exceeding maxLength', () => {
        const window = [1, 2, 3];
        const result = (0, blockPoller_1.appendToWindow)(window, 4, 3);
        strict_1.default.deepEqual(result, [2, 3, 4]);
        strict_1.default.deepEqual(window, [1, 2, 3]);
    });
    await test('appendToWindow with non-positive maxLength always returns empty', () => {
        const window = [1, 2, 3];
        strict_1.default.deepEqual((0, blockPoller_1.appendToWindow)(window, 4, 0), []);
        strict_1.default.deepEqual((0, blockPoller_1.appendToWindow)(window, 4, -5), []);
    });
    await test('computeApproximateTPS returns 0 for insufficient data points or mismatch', () => {
        strict_1.default.equal((0, blockPoller_1.computeApproximateTPS)([], []), 0);
        strict_1.default.equal((0, blockPoller_1.computeApproximateTPS)([1], [10]), 0);
        strict_1.default.equal((0, blockPoller_1.computeApproximateTPS)([1, 2], [10]), 0);
    });
    await test('computeApproximateTPS returns 0 for non-positive time delta', () => {
        strict_1.default.equal((0, blockPoller_1.computeApproximateTPS)([10, 10], [5, 5]), 0);
        strict_1.default.equal((0, blockPoller_1.computeApproximateTPS)([20, 10], [5, 5]), 0);
    });
    await test('computeApproximateTPS computes correct TPS for valid window', () => {
        const timestamps = [10, 20, 30];
        const txCounts = [5, 10, 15]; // total = 30, delta = 20 -> TPS = 1.5
        const tps = (0, blockPoller_1.computeApproximateTPS)(timestamps, txCounts);
        strict_1.default.ok(Math.abs(tps - 1.5) < 1e-9);
    });
}
async function runIntegrationTest() {
    const gateArUrl = process.env.GATE_AR_URL || process.env.VITE_GATE_AR_URL || 'https://gate.ar';
    console.log(`[BlockPoller:test] Running live latest-block fetch against ${gateArUrl} (set GATE_AR_URL to override)`);
    await test('getLatestBlockInfo fetches a block from live gateway', async () => {
        const client = (0, blockPoller_1.createGatewayHttpClient)(gateArUrl);
        const info = await (0, blockPoller_1.getLatestBlockInfo)(client);
        strict_1.default.ok(typeof info.height === 'number' && info.height >= 0);
        strict_1.default.ok(typeof info.id === 'string' && info.id.length > 0);
        strict_1.default.ok(typeof info.timestamp === 'number' && info.timestamp > 0);
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
        }
        else {
            console.log('[BlockPoller:test] Skipping live gateway test (set RUN_LIVE_GATE_TEST=1 to enable)');
        }
        // Optional Redis integration test: writes a synthetic block and stats into Redis and
        // verifies the expected keys are present. Disabled by default.
        if (process.env.RUN_REDIS_WRITE_TEST === '1') {
            const redisUrl = process.env.REDIS_URL || 'redis://75.119.146.45:32768';
            console.log(`[BlockPoller:test] Running Redis integration test against ${redisUrl}`);
            const redis = (0, phin_cache_1.createRedisClient)(redisUrl);
            await test('cache helpers write expected keys to Redis', async () => {
                const nowMs = Date.now();
                const nowSec = Math.floor(nowMs / 1000);
                const block = {
                    height: nowSec, // synthetic but unique-ish
                    id: `test-block-${nowMs}`,
                    timestamp: nowSec,
                    weaveSize: '0',
                    blockSize: '0',
                    txCount: 2,
                    reward: '0',
                    previousBlock: 'test-prev'
                };
                const transactions = [
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
                const blockPayload = (0, blockPoller_1.buildBlockCachePayload)(block, transactions);
                const stats = {
                    blockHeight: block.height,
                    weaveSize: block.weaveSize,
                    lastBlockTimestamp: block.timestamp,
                    approximateTPS: 0.5,
                    lastBlockTxCount: block.txCount,
                    updatedAt: nowMs
                };
                await (0, blockPoller_1.cacheBlock)(redis, blockPayload);
                await (0, blockPoller_1.cacheTransactions)(redis, transactions, block.height);
                await (0, blockPoller_1.cacheNetworkStats)(redis, stats);
                await (0, blockPoller_1.persistLastKnownHeight)(redis, block.height);
                const blockKey = phin_cache_1.CacheKeys.blockByHeight(block.height);
                const statsKey = phin_cache_1.CacheKeys.networkStats();
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
                    throw new Error('block:height key not found in Redis after cacheBlock');
                }
                if (!storedStats) {
                    throw new Error('network:stats key not found in Redis after cacheNetworkStats');
                }
                if (!lastHeight) {
                    throw new Error('indexer:lastHeight key not found in Redis after persistLastKnownHeight');
                }
            });
            redis.disconnect();
        }
        else {
            console.log('[BlockPoller:test] Skipping Redis integration test (set RUN_REDIS_WRITE_TEST=1 to enable)');
        }
        console.log('[BlockPoller:test] All tests completed');
    }
    catch (err) {
        console.error('[BlockPoller:test] Test suite failed');
        process.exitCode = 1;
    }
}
main().catch((err) => {
    console.error('[BlockPoller:test] Unhandled error in test runner', err);
    process.exitCode = 1;
});
