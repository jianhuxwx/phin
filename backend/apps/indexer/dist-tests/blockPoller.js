"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGatewayHttpClient = createGatewayHttpClient;
exports.getLatestBlockInfo = getLatestBlockInfo;
exports.fetchTransactionBatch = fetchTransactionBatch;
exports.fetchAllBlockTransactions = fetchAllBlockTransactions;
exports.buildBlockCachePayload = buildBlockCachePayload;
exports.buildNetworkStats = buildNetworkStats;
exports.appendToWindow = appendToWindow;
exports.computeApproximateTPS = computeApproximateTPS;
exports.cacheBlock = cacheBlock;
exports.cacheTransactions = cacheTransactions;
exports.cacheNetworkStats = cacheNetworkStats;
exports.persistLastKnownHeight = persistLastKnownHeight;
exports.readLastKnownHeight = readLastKnownHeight;
exports.publishBlockEvents = publishBlockEvents;
exports.startBlockPoller = startBlockPoller;
const phin_cache_1 = require("phin-cache");
// Sliding window for TPS calculation — last 10 blocks
let recentHeights = [];
let recentTimestamps = [];
let recentTxCounts = [];
// Module-level runtime state used by the poller
let pollerState = null;
let gatewayClient = null;
let redisClient = null;
let redisPubClient = null;
const RECENT_BLOCKS_KEY = 'blocks:recent';
const RECENT_TRANSACTIONS_KEY = 'transactions:recent';
const LAST_HEIGHT_KEY = 'indexer:lastHeight';
const LAST_HEIGHT_AT_KEY = 'indexer:lastHeightAt';
const DEFAULT_POLL_INTERVAL_MS = 5000;
function createGatewayHttpClient(baseUrl) {
    const url = baseUrl.replace(/\/+$/, '');
    return {
        async query(gql, variables) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);
            try {
                const response = await fetch(`${url}/graphql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    body: JSON.stringify({
                        query: gql,
                        variables: variables ?? {}
                    }),
                    signal: controller.signal
                });
                const text = await response.text();
                if (!response.ok) {
                    throw new Error(`[BlockPoller] Gateway HTTP error: status=${response.status} body=${text}`);
                }
                let json;
                try {
                    json = text ? JSON.parse(text) : {};
                }
                catch (err) {
                    throw new Error(`[BlockPoller] Failed to parse GraphQL response JSON: ${err.message}`);
                }
                if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
                    const message = json.errors[0]?.message ?? 'Unknown GraphQL error';
                    throw new Error(`[BlockPoller] GraphQL error: ${message}`);
                }
                if (!('data' in json)) {
                    throw new Error('[BlockPoller] GraphQL response missing data field');
                }
                return json.data;
            }
            finally {
                clearTimeout(timeout);
            }
        }
    };
}
const GET_LATEST_BLOCK_INFO = /* GraphQL */ `
  query GetLatestBlock {
    blocks(first: 1, sort: HEIGHT_DESC) {
      edges {
        node {
          height
          id
          timestamp
          previous
        }
      }
    }
  }
`;
async function getLatestBlockInfo(client) {
    const data = await client.query(GET_LATEST_BLOCK_INFO);
    const edge = data.blocks.edges[0];
    if (!edge || !edge.node) {
        throw new Error('[BlockPoller] Gateway returned no blocks in GetNetworkInfo response');
    }
    const node = edge.node;
    if (!node.id || node.timestamp == null) {
        throw new Error('[BlockPoller] Latest block node is missing required fields (id or timestamp)');
    }
    return {
        height: node.height,
        id: node.id,
        timestamp: node.timestamp,
        // These extended fields are not exposed by the current gate.ar schema.
        // Default to zero-like values; they can be populated from a richer endpoint in the future.
        weaveSize: '0',
        blockSize: '0',
        txCount: 0,
        reward: '0',
        previousBlock: node.previous ?? ''
    };
}
const GET_TRANSACTIONS_BY_IDS = /* GraphQL */ `
  query GetTransactions($ids: [ID!]!) {
    transactions(ids: $ids, first: 100) {
      edges {
        node {
          id
          anchor
          signature
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
          block {
            height
            timestamp
          }
        }
      }
    }
  }
`;
const GET_BLOCK_TRANSACTIONS_BY_HEIGHT = /* GraphQL */ `
  query GetBlockTransactionsByHeight($height: Int!, $cursor: String) {
    transactions(
      block: { min: $height, max: $height }
      first: 100
      after: $cursor
      sort: HEIGHT_ASC
    ) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          anchor
          signature
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
          block {
            height
            timestamp
          }
        }
      }
    }
  }
`;
async function fetchTransactionBatch(client, ids) {
    if (ids.length === 0) {
        return [];
    }
    const data = await client.query(GET_TRANSACTIONS_BY_IDS, { ids });
    const edges = data.transactions?.edges ?? [];
    if (!edges.length) {
        return [];
    }
    return edges.map((e) => {
        const node = e.node;
        const sizeNumber = Number(node.data.size);
        return {
            id: node.id,
            anchor: node.anchor,
            signature: node.signature,
            owner: { address: node.owner.address },
            fee: { ar: node.fee.ar },
            quantity: { ar: node.quantity.ar },
            data: {
                size: Number.isFinite(sizeNumber) && sizeNumber >= 0 ? sizeNumber : 0,
                type: node.data.type
            },
            tags: node.tags,
            block: node.block ? { height: node.block.height, timestamp: node.block.timestamp } : null
        };
    });
}
async function fetchAllBlockTransactions(client, txIds) {
    if (!txIds.length) {
        return [];
    }
    const chunkSize = 50;
    const chunks = [];
    for (let i = 0; i < txIds.length; i += chunkSize) {
        chunks.push(txIds.slice(i, i + chunkSize));
    }
    const results = await Promise.allSettled(chunks.map((chunk) => fetchTransactionBatch(client, chunk)));
    const all = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            all.push(...result.value);
        }
        else {
            console.warn(`[BlockPoller] Failed to fetch transaction chunk index=${index}: ${result.reason.message}`);
        }
    });
    return all;
}
async function fetchBlockTransactionsByHeight(client, height) {
    let cursor;
    const all = [];
    // Paginate until no more pages are available.
    // Use a defensive upper bound on iterations to avoid infinite loops in case of misbehaving gateways.
    const maxPages = 1000;
    for (let page = 0; page < maxPages; page += 1) {
        const data = await client.query(GET_BLOCK_TRANSACTIONS_BY_HEIGHT, {
            height,
            cursor
        });
        const conn = data.transactions;
        const edges = conn?.edges ?? [];
        for (const edge of edges) {
            const node = edge.node;
            const sizeNumber = Number(node.data.size);
            all.push({
                id: node.id,
                anchor: node.anchor,
                signature: node.signature,
                owner: { address: node.owner.address },
                fee: { ar: node.fee.ar },
                quantity: { ar: node.quantity.ar },
                data: {
                    size: Number.isFinite(sizeNumber) && sizeNumber >= 0 ? sizeNumber : 0,
                    type: node.data.type
                },
                tags: node.tags,
                block: node.block ? { height: node.block.height, timestamp: node.block.timestamp } : null
            });
        }
        const hasNextPage = conn?.pageInfo?.hasNextPage ?? false;
        if (!hasNextPage || edges.length === 0) {
            break;
        }
        cursor = edges[edges.length - 1].cursor;
    }
    return all;
}
function buildBlockCachePayload(blockInfo, transactions) {
    return {
        height: blockInfo.height,
        id: blockInfo.id,
        timestamp: blockInfo.timestamp,
        weaveSize: blockInfo.weaveSize,
        blockSize: blockInfo.blockSize,
        txCount: blockInfo.txCount,
        reward: blockInfo.reward,
        previousBlock: blockInfo.previousBlock,
        transactions,
        indexedAt: Date.now()
    };
}
function buildNetworkStats(blockInfo, _recentHeights, recentTs, recentTxs) {
    const windowSize = 5;
    const timestamps = appendToWindow(recentTs, blockInfo.timestamp, windowSize);
    const txCounts = appendToWindow(recentTxs, blockInfo.txCount, windowSize);
    const approximateTPS = computeApproximateTPS(timestamps, txCounts);
    return {
        blockHeight: blockInfo.height,
        weaveSize: blockInfo.weaveSize,
        lastBlockTimestamp: blockInfo.timestamp,
        approximateTPS,
        lastBlockTxCount: blockInfo.txCount,
        updatedAt: Date.now()
    };
}
/**
 * Pure helper to append a new value to a sliding window, keeping at most `maxLength` items.
 */
function appendToWindow(window, value, maxLength) {
    const next = window.concat([value]);
    if (maxLength <= 0) {
        return [];
    }
    if (next.length <= maxLength) {
        return next;
    }
    return next.slice(next.length - maxLength);
}
/**
 * Pure helper to compute approximate TPS from parallel timestamp and tx count arrays.
 * Expects `timestamps.length === txCounts.length`. Returns 0 if fewer than 2 points
 * are provided or if the overall time delta is non-positive.
 */
function computeApproximateTPS(timestamps, txCounts) {
    if (timestamps.length !== txCounts.length || timestamps.length < 2) {
        return 0;
    }
    const totalTx = txCounts.reduce((sum, v) => sum + v, 0);
    const timeDelta = timestamps[timestamps.length - 1] - timestamps[0];
    if (timeDelta <= 0) {
        return 0;
    }
    return totalTx / timeDelta;
}
async function cacheBlock(redis, payload) {
    const summary = {
        height: payload.height,
        id: payload.id,
        timestamp: payload.timestamp,
        txCount: payload.txCount,
        weaveSize: payload.weaveSize,
        reward: payload.reward
    };
    const pipeline = redis.pipeline();
    pipeline.set(phin_cache_1.CacheKeys.block(payload.id), JSON.stringify(payload), 'EX', phin_cache_1.TTL.BLOCK_DETAIL);
    pipeline.set(phin_cache_1.CacheKeys.blockByHeight(payload.height), JSON.stringify(payload), 'EX', phin_cache_1.TTL.BLOCK_DETAIL);
    pipeline.lpush(RECENT_BLOCKS_KEY, JSON.stringify(summary));
    pipeline.ltrim(RECENT_BLOCKS_KEY, 0, 19);
    await pipeline.exec();
}
async function cacheTransactions(redis, transactions, _blockHeight) {
    if (!transactions.length) {
        return;
    }
    const pipeline = redis.pipeline();
    for (const tx of transactions) {
        pipeline.set(phin_cache_1.CacheKeys.transaction(tx.id), JSON.stringify(tx), 'EX', phin_cache_1.TTL.TRANSACTION);
        if (tx.data.size > 0) {
            pipeline.lpush(RECENT_TRANSACTIONS_KEY, tx.id);
        }
    }
    pipeline.ltrim(RECENT_TRANSACTIONS_KEY, 0, 99);
    await pipeline.exec();
}
async function cacheNetworkStats(redis, stats) {
    await redis.set(phin_cache_1.CacheKeys.networkStats(), JSON.stringify(stats));
}
async function persistLastKnownHeight(redis, height) {
    const pipeline = redis.pipeline();
    const now = Date.now();
    pipeline.set(LAST_HEIGHT_KEY, String(height));
    pipeline.set(LAST_HEIGHT_AT_KEY, String(now));
    await pipeline.exec();
}
async function readLastKnownHeight(redis) {
    const value = await redis.get(LAST_HEIGHT_KEY);
    if (!value) {
        return 0;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        console.warn(`[BlockPoller] Invalid lastKnownHeight value in Redis ("${value}"), defaulting to 0`);
        return 0;
    }
    return parsed;
}
async function publishBlockEvents(redis, blockInfo, transactions, stats) {
    const now = Date.now();
    const richTransactions = transactions
        .filter((tx) => tx.data.size > 0)
        .slice(0, 5)
        .map((tx) => ({
        id: tx.id,
        owner: tx.owner.address,
        dataSize: tx.data.size,
        contentType: tx.data.type,
        appName: tx.tags.find((t) => t.name === 'App-Name')?.value ?? null,
        fileName: tx.tags.find((t) => t.name === 'File-Name')?.value ?? null
    }));
    const newBlockPayload = {
        type: 'new_block',
        timestamp: now,
        data: {
            height: blockInfo.height,
            id: blockInfo.id,
            blockTimestamp: blockInfo.timestamp,
            txCount: blockInfo.txCount,
            weaveSize: blockInfo.weaveSize,
            reward: blockInfo.reward,
            recentTransactions: richTransactions
        }
    };
    const statsPayload = {
        type: 'stats_update',
        timestamp: now,
        data: stats
    };
    const perTxMessages = transactions
        .filter((tx) => tx.data.size > 0)
        .slice(0, 20)
        .map((tx) => ({
        type: 'new_transaction',
        timestamp: now,
        data: {
            id: tx.id,
            owner: tx.owner.address,
            dataSize: tx.data.size,
            contentType: tx.data.type,
            fee: tx.fee.ar,
            blockHeight: blockInfo.height,
            appName: tx.tags.find((t) => t.name === 'App-Name')?.value ?? null,
            fileName: tx.tags.find((t) => t.name === 'File-Name')?.value ?? null,
            tags: tx.tags
        }
    }));
    const publishPromises = [];
    publishPromises.push(redis.publish(phin_cache_1.PubSubChannels.NEW_BLOCK, JSON.stringify(newBlockPayload)));
    publishPromises.push(redis.publish(phin_cache_1.PubSubChannels.STATS_UPDATE, JSON.stringify(statsPayload)));
    for (const msg of perTxMessages) {
        publishPromises.push(redis.publish(phin_cache_1.PubSubChannels.NEW_TRANSACTION, JSON.stringify(msg)));
    }
    const results = await Promise.allSettled(publishPromises);
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.warn(`[BlockPoller] Failed to publish event index=${index}: ${result.reason.message}`);
        }
    });
}
async function processNewBlock(client, redis, blockInfo) {
    console.log(`[BlockPoller] New block detected: height=${blockInfo.height} id=${blockInfo.id}`);
    let transactions = [];
    try {
        transactions = await fetchBlockTransactionsByHeight(client, blockInfo.height);
    }
    catch (err) {
        console.error(`[BlockPoller] Failed to fetch transactions for block ${blockInfo.height}: ${err.message}`, err);
        throw err;
    }
    const blockWithCounts = {
        ...blockInfo,
        txCount: transactions.length
    };
    const blockPayload = buildBlockCachePayload(blockWithCounts, transactions);
    const statsPayload = buildNetworkStats(blockWithCounts, recentHeights, recentTimestamps, recentTxCounts);
    // Update sliding window state after computing stats to keep function pure.
    const slidingWindowSize = 10;
    recentHeights = appendToWindow(recentHeights, blockWithCounts.height, slidingWindowSize);
    recentTimestamps = appendToWindow(recentTimestamps, blockWithCounts.timestamp, slidingWindowSize);
    recentTxCounts = appendToWindow(recentTxCounts, blockWithCounts.txCount, slidingWindowSize);
    const cachePromises = [
        cacheBlock(redis, blockPayload),
        cacheTransactions(redis, transactions, blockInfo.height),
        cacheNetworkStats(redis, statsPayload),
        persistLastKnownHeight(redis, blockInfo.height)
    ];
    const cacheResults = await Promise.allSettled(cachePromises);
    cacheResults.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`[BlockPoller] Cache operation index=${index} failed: ${result.reason.message}`);
        }
    });
    if (redisPubClient) {
        try {
            await publishBlockEvents(redisPubClient, blockWithCounts, transactions, statsPayload);
        }
        catch (err) {
            // publishBlockEvents itself should not throw, but guard just in case.
            console.warn(`[BlockPoller] Unexpected error during publishBlockEvents: ${err.message}`);
        }
    }
    else {
        console.warn('[BlockPoller] Redis pub client not initialised, skipping publishBlockEvents');
    }
    console.log(`[BlockPoller] Block ${blockInfo.height} processed: ${transactions.length} transactions indexed`);
}
async function withRetry(fn, maxAttempts = 3, delayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            console.error(`[BlockPoller] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
            if (attempt < maxAttempts && delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError ?? new Error('[BlockPoller] withRetry failed with unknown error');
}
async function runPollerTick(client, redis, state) {
    try {
        const latestBlock = await withRetry(() => getLatestBlockInfo(client), 2, 1000);
        const height = latestBlock.height;
        if (height === state.lastKnownHeight) {
            console.log(`[BlockPoller] No new block (height=${height})`);
            return;
        }
        if (state.lastKnownHeight !== 0) {
            const diff = height - state.lastKnownHeight;
            if (diff > 5) {
                console.warn(`[BlockPoller] Height jumped by ${diff} — possible missed blocks`);
            }
        }
        if (height > state.lastKnownHeight) {
            await processNewBlock(client, redis, latestBlock);
            state.lastKnownHeight = height;
            state.consecutiveErrors = 0;
            state.lastSuccessAt = Date.now();
        }
    }
    catch (err) {
        state.consecutiveErrors += 1;
        console.error(`[BlockPoller] Poller tick error (consecutiveErrors=${state.consecutiveErrors}): ${err.message}`, err);
        if (state.consecutiveErrors >= 10) {
            console.warn(`[BlockPoller] Poller has encountered ${state.consecutiveErrors} consecutive errors and may be stuck`);
        }
    }
}
function startBlockPoller() {
    const gateArUrl = process.env.GATE_AR_URL;
    const redisUrl = process.env.REDIS_URL;
    if (!gateArUrl) {
        throw new Error('[BlockPoller] Missing required environment variable: GATE_AR_URL');
    }
    if (!redisUrl) {
        throw new Error('[BlockPoller] Missing required environment variable: REDIS_URL');
    }
    const pollIntervalMs = Number.parseInt(process.env.POLL_INTERVAL_MS ?? '', 10) || DEFAULT_POLL_INTERVAL_MS;
    gatewayClient = createGatewayHttpClient(gateArUrl);
    redisClient = (0, phin_cache_1.createRedisClient)(redisUrl);
    redisPubClient = (0, phin_cache_1.createRedisClient)(redisUrl);
    pollerState = {
        lastKnownHeight: 0,
        consecutiveErrors: 0,
        lastSuccessAt: null
    };
    // Initialise sliding window state
    recentHeights = [];
    recentTimestamps = [];
    recentTxCounts = [];
    (async () => {
        try {
            if (!redisClient || !gatewayClient || !pollerState) {
                console.error('[BlockPoller] Poller initialisation failed: missing required clients or state');
                return;
            }
            const initialHeight = await readLastKnownHeight(redisClient);
            pollerState.lastKnownHeight = initialHeight;
            console.log(`[BlockPoller] Starting. Last known height: ${pollerState.lastKnownHeight}`);
            await runPollerTick(gatewayClient, redisClient, pollerState);
        }
        catch (err) {
            console.error(`[BlockPoller] Failed during initial poller tick: ${err.message}`, err);
        }
    })().catch((err) => {
        console.error(`[BlockPoller] Unhandled error in poller initialisation: ${err.message}`, err);
    });
    const interval = setInterval(() => {
        if (!gatewayClient || !redisClient || !pollerState) {
            console.warn('[BlockPoller] Poller tick skipped because clients or state are not initialised');
            return;
        }
        runPollerTick(gatewayClient, redisClient, pollerState).catch((err) => {
            console.error(`[BlockPoller] Unhandled error in poller tick: ${err.message}`, err);
        });
    }, pollIntervalMs);
    // Ensure Redis clients are disconnected when the process exits.
    const cleanup = () => {
        if (interval) {
            clearInterval(interval);
        }
        if (redisClient) {
            redisClient.disconnect();
        }
        if (redisPubClient) {
            redisPubClient.disconnect();
        }
    };
    process.on('exit', cleanup);
    return interval;
}
