import type Redis from 'ioredis';
import { createRedisClient, CacheKeys, TTL, PubSubChannels, waitForRedisReady } from 'phin-cache';
import { chunkArray, withRetry } from '../utils/retry';

// Sliding window for TPS calculation — last 10 blocks
let recentHeights: number[] = [];
let recentTimestamps: number[] = [];
let recentTxCounts: number[] = [];

export interface GatewayHttpClient {
  query<T>(gql: string, variables?: Record<string, unknown>): Promise<T>;
  getJson<T>(path: string): Promise<T>;
}

export interface LatestBlockInfo {
  height: number;
  id: string; // indep_hash
  timestamp: number; // unix seconds
  weaveSize: string; // bytes as string (Arweave uses large integers)
  blockSize: string;
  txCount: number;
  reward: string;
  previousBlock: string;
}

export interface ArweaveTransactionNode {
  id: string;
  anchor: string;
  signature: string;
  owner: { address: string };
  fee: { ar: string };
  quantity: { ar: string };
  data: { size: number; type: string | null };
  tags: Array<{ name: string; value: string }>;
  block: { height: number; timestamp: number } | null;
}

export interface BlockCachePayload {
  height: number;
  id: string;
  timestamp: number;
  weaveSize: string;
  blockSize: string;
  txCount: number;
  reward: string;
  previousBlock: string;
  transactions: ArweaveTransactionNode[];
  indexedAt: number; // Date.now() — when phin indexed this block
}

export interface NetworkStatsPayload {
  blockHeight: number;
  weaveSize: string;
  lastBlockTimestamp: number;
  approximateTPS: number;
  lastBlockTxCount: number;
  updatedAt: number;
}

interface PollerState {
  lastKnownHeight: number;
  consecutiveErrors: number;
  lastSuccessAt: number | null;
}

// Module-level runtime state used by the poller
let pollerState: PollerState | null = null;
let gatewayClient: GatewayHttpClient | null = null;
let redisClient: Redis | null = null;
let redisPubClient: Redis | null = null;
let pollerTickInProgress = false;

const RECENT_BLOCKS_KEY = 'blocks:recent';
const RECENT_TRANSACTIONS_KEY = 'transactions:recent';
const LAST_HEIGHT_KEY = 'indexer:lastHeight';
const LAST_HEIGHT_AT_KEY = 'indexer:lastHeightAt';

const DEFAULT_POLL_INTERVAL_MS = 5000;

export function createGatewayHttpClient(baseUrl: string): GatewayHttpClient {
  const url = baseUrl.replace(/\/+$/, '');

  return {
    async query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
      return withRetry(
        async () => {
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
              throw new Error(
                `[BlockPoller] Gateway HTTP error: status=${response.status} body=${text}`
              );
            }

            let json: any;
            try {
              json = text ? JSON.parse(text) : {};
            } catch (err) {
              throw new Error(
                `[BlockPoller] Failed to parse GraphQL response JSON: ${(err as Error).message}`
              );
            }

            if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
              const message = json.errors[0]?.message ?? 'Unknown GraphQL error';
              throw new Error(`[BlockPoller] GraphQL error: ${message}`);
            }

            if (!('data' in json)) {
              throw new Error('[BlockPoller] GraphQL response missing data field');
            }

            return json.data as T;
          } finally {
            clearTimeout(timeout);
          }
        },
        {
          backoff: true,
          logger: ({ attempt, maxAttempts, error }) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(
              `[GatewayHttpClient] Attempt ${attempt}/${maxAttempts} failed: ${message}`
            );
          }
        }
      );
    },
    async getJson<T>(path: string): Promise<T> {
      return withRetry(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);

          try {
            const response = await fetch(`${url}${path}`, {
              headers: {
                Accept: 'application/json'
              },
              signal: controller.signal
            });

            const text = await response.text();

            if (!response.ok) {
              throw new Error(
                `[BlockPoller] Gateway HTTP error: status=${response.status} body=${text}`
              );
            }

            try {
              return (text ? JSON.parse(text) : {}) as T;
            } catch (err) {
              throw new Error(
                `[BlockPoller] Failed to parse HTTP JSON response: ${(err as Error).message}`
              );
            }
          } finally {
            clearTimeout(timeout);
          }
        },
        {
          backoff: true,
          logger: ({ attempt, maxAttempts, error }) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(
              `[GatewayHttpClient] HTTP attempt ${attempt}/${maxAttempts} failed: ${message}`
            );
          }
        }
      );
    }
  };
}

interface GatewayBlockMetadata {
  txCount: number;
  weaveSize: string;
  blockSize: string;
  reward: string;
}

function toStringNumber(value: unknown, fallback = '0'): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function parseBlockMetadata(payload: any): GatewayBlockMetadata {
  const txs = Array.isArray(payload?.txs) ? payload.txs : [];

  return {
    txCount: toNumber(payload?.tx_count ?? payload?.txCount, txs.length),
    weaveSize: toStringNumber(payload?.weave_size ?? payload?.weaveSize, '0'),
    blockSize: toStringNumber(payload?.block_size ?? payload?.blockSize, '0'),
    reward: toStringNumber(payload?.reward, '0')
  };
}

async function fetchBlockMetadata(
  client: GatewayHttpClient,
  block: Pick<LatestBlockInfo, 'id' | 'height'>
): Promise<GatewayBlockMetadata | null> {
  try {
    return parseBlockMetadata(await client.getJson(`/block/hash/${block.id}`));
  } catch {
    try {
      return parseBlockMetadata(await client.getJson(`/block/height/${block.height}`));
    } catch {
      return null;
    }
  }
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

const GET_BLOCK_BY_HEIGHT = /* GraphQL */ `
  query GetBlockByHeight($height: Int!) {
    blocks(first: 1, sort: HEIGHT_DESC, height: { min: $height, max: $height }) {
      edges {
        node {
          id
          height
          timestamp
          previous
        }
      }
    }
  }
`;

export async function getLatestBlockInfo(
  client: GatewayHttpClient
): Promise<LatestBlockInfo> {
  interface ResponseShape {
    blocks: {
      edges: Array<{
        node: {
          height: number;
          id: string | null;
          timestamp: number | null;
          previous: string | null;
        };
      }>;
    };
  }

  const data = await client.query<ResponseShape>(GET_LATEST_BLOCK_INFO);
  const edge = data.blocks.edges[0];

  if (!edge || !edge.node) {
    throw new Error('[BlockPoller] Gateway returned no blocks in GetNetworkInfo response');
  }

  const node = edge.node;

  if (!node.id || node.timestamp == null) {
    throw new Error(
      '[BlockPoller] Latest block node is missing required fields (id or timestamp)'
    );
  }

  const metadata = await fetchBlockMetadata(client, {
    id: node.id,
    height: node.height
  });

  return {
    height: node.height,
    id: node.id,
    timestamp: node.timestamp,
    weaveSize: metadata?.weaveSize ?? '0',
    blockSize: metadata?.blockSize ?? '0',
    txCount: metadata?.txCount ?? 0,
    reward: metadata?.reward ?? '0',
    previousBlock: node.previous ?? ''
  };
}

export async function getBlockInfoByHeight(
  client: GatewayHttpClient,
  height: number
): Promise<LatestBlockInfo> {
  interface ResponseShape {
    blocks: {
      edges: Array<{
        node: {
          id: string | null;
          height: number;
          timestamp: number | null;
          previous: string | null;
        };
      }>;
    };
  }

  const data = await client.query<ResponseShape>(GET_BLOCK_BY_HEIGHT, { height });
  const edge = data.blocks.edges[0];
  const block = edge?.node;

  if (!block || !block.id || block.timestamp == null) {
    throw new Error(
      `[BlockPoller] Block lookup by height failed or returned incomplete data (height=${height})`
    );
  }

  const metadata = await fetchBlockMetadata(client, {
    id: block.id,
    height: block.height
  });

  return {
    height: block.height,
    id: block.id,
    timestamp: block.timestamp,
    weaveSize: metadata?.weaveSize ?? '0',
    blockSize: metadata?.blockSize ?? '0',
    txCount: metadata?.txCount ?? 0,
    reward: metadata?.reward ?? '0',
    previousBlock: block.previous ?? ''
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

export async function fetchTransactionBatch(
  client: GatewayHttpClient,
  ids: string[]
): Promise<ArweaveTransactionNode[]> {
  if (ids.length === 0) {
    return [];
  }

  interface ResponseShape {
    transactions: {
      edges: Array<{
        node: {
          id: string;
          anchor: string;
          signature: string;
          owner: { address: string };
          fee: { ar: string };
          quantity: { ar: string };
          data: { size: string; type: string | null };
          tags: Array<{ name: string; value: string }>;
          block: { height: number; timestamp: number } | null;
        };
      }>;
    };
  }

  const data = await client.query<ResponseShape>(GET_TRANSACTIONS_BY_IDS, { ids });
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

export async function fetchAllBlockTransactions(
  client: GatewayHttpClient,
  txIds: string[]
): Promise<ArweaveTransactionNode[]> {
  if (!txIds.length) {
    return [];
  }

  const chunkSize = 50;
  const chunks = chunkArray(txIds, chunkSize);

  const results = await Promise.allSettled(
    chunks.map((chunk) => fetchTransactionBatch(client, chunk))
  );

  const all: ArweaveTransactionNode[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    } else {
      console.warn(
        `[BlockPoller] Failed to fetch transaction chunk index=${index}: ${
          (result.reason as Error).message
        }`
      );
    }
  });

  return all;
}

async function fetchBlockTransactionsByHeight(
  client: GatewayHttpClient,
  height: number
): Promise<ArweaveTransactionNode[]> {
  let cursor: string | undefined;
  const all: ArweaveTransactionNode[] = [];

  // Paginate until no more pages are available.
  // Use a defensive upper bound on iterations to avoid infinite loops in case of misbehaving gateways.
  const maxPages = 1000;

  for (let page = 0; page < maxPages; page += 1) {
    interface ResponseShape {
      transactions: {
        pageInfo: {
          hasNextPage: boolean;
        };
        edges: Array<{
          cursor: string;
          node: {
            id: string;
            anchor: string;
            signature: string;
            owner: { address: string };
            fee: { ar: string };
            quantity: { ar: string };
            data: { size: string; type: string | null };
            tags: Array<{ name: string; value: string }>;
            block: { height: number; timestamp: number } | null;
          };
        }>;
      };
    }

    const data = await client.query<ResponseShape>(GET_BLOCK_TRANSACTIONS_BY_HEIGHT, {
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

export function buildBlockCachePayload(
  blockInfo: LatestBlockInfo,
  transactions: ArweaveTransactionNode[]
): BlockCachePayload {
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

export function buildNetworkStats(
  blockInfo: LatestBlockInfo,
  _recentHeights: number[],
  recentTs: number[],
  recentTxs: number[]
): NetworkStatsPayload {
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
export function appendToWindow<T>(window: T[], value: T, maxLength: number): T[] {
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
export function computeApproximateTPS(
  timestamps: number[],
  txCounts: number[]
): number {
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

export async function cacheBlock(redis: Redis, payload: BlockCachePayload): Promise<void> {
  const summary = {
    height: payload.height,
    id: payload.id,
    timestamp: payload.timestamp,
    txCount: payload.txCount,
    weaveSize: payload.weaveSize,
    reward: payload.reward
  };

  const pipeline = redis.pipeline();

  pipeline.set(
    CacheKeys.block(payload.id),
    JSON.stringify(payload),
    'EX',
    TTL.BLOCK_DETAIL
  );

  pipeline.set(
    CacheKeys.blockByHeight(payload.height),
    JSON.stringify(payload),
    'EX',
    TTL.BLOCK_DETAIL
  );

  pipeline.lpush(RECENT_BLOCKS_KEY, JSON.stringify(summary));
  pipeline.ltrim(RECENT_BLOCKS_KEY, 0, 19);

  await pipeline.exec();
}

export async function cacheTransactions(
  redis: Redis,
  transactions: ArweaveTransactionNode[]
): Promise<void> {
  if (!transactions.length) {
    return;
  }

  const pipeline = redis.pipeline();

  for (const tx of transactions) {
    pipeline.set(
      CacheKeys.transaction(tx.id),
      JSON.stringify(tx),
      'EX',
      TTL.TRANSACTION
    );

    if (tx.data.size > 0) {
      pipeline.lpush(RECENT_TRANSACTIONS_KEY, tx.id);
    }
  }

  pipeline.ltrim(RECENT_TRANSACTIONS_KEY, 0, 99);

  await pipeline.exec();
}

export async function cacheNetworkStats(
  redis: Redis,
  stats: NetworkStatsPayload
): Promise<void> {
  await redis.set(CacheKeys.networkStats(), JSON.stringify(stats));
}

export async function persistLastKnownHeight(redis: Redis, height: number): Promise<void> {
  const pipeline = redis.pipeline();
  const now = Date.now();

  pipeline.set(LAST_HEIGHT_KEY, String(height));
  pipeline.set(LAST_HEIGHT_AT_KEY, String(now));

  await pipeline.exec();
}

export async function readLastKnownHeight(redis: Redis): Promise<number> {
  const value = await redis.get(LAST_HEIGHT_KEY);
  if (!value) {
    return 0;
  }

  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    console.warn(
      `[BlockPoller] Invalid lastKnownHeight value in Redis ("${value}"), defaulting to 0`
    );
    return 0;
  }

  return parsed;
}

export async function publishBlockEvents(
  redis: Redis,
  blockInfo: LatestBlockInfo,
  transactions: ArweaveTransactionNode[],
  stats: NetworkStatsPayload
): Promise<void> {
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

  const publishPromises: Promise<unknown>[] = [];

  publishPromises.push(
    redis.publish(PubSubChannels.NEW_BLOCK, JSON.stringify(newBlockPayload))
  );

  publishPromises.push(
    redis.publish(PubSubChannels.STATS_UPDATE, JSON.stringify(statsPayload))
  );

  for (const msg of perTxMessages) {
    publishPromises.push(
      redis.publish(PubSubChannels.NEW_TRANSACTION, JSON.stringify(msg))
    );
  }

  const results = await Promise.allSettled(publishPromises);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(
        `[BlockPoller] Failed to publish event index=${index}: ${
          (result.reason as Error).message
        }`
      );
    }
  });
}

async function processNewBlock(
  client: GatewayHttpClient,
  redis: Redis,
  blockInfo: LatestBlockInfo
): Promise<void> {
  console.log(
    `[BlockPoller] New block detected: height=${blockInfo.height} id=${blockInfo.id}`
  );

  let transactions: ArweaveTransactionNode[] = [];

  try {
    transactions = await fetchBlockTransactionsByHeight(client, blockInfo.height);
  } catch (err) {
    console.error(
      `[BlockPoller] Failed to fetch transactions for block ${blockInfo.height}: ${
        (err as Error).message
      }`,
      err
    );
    throw err;
  }

  const blockWithCounts: LatestBlockInfo = {
    ...blockInfo,
    txCount: transactions.length
  };

  const blockPayload = buildBlockCachePayload(blockWithCounts, transactions);
  const statsPayload = buildNetworkStats(
    blockWithCounts,
    recentHeights,
    recentTimestamps,
    recentTxCounts
  );

  // Update sliding window state after computing stats to keep function pure.
  const slidingWindowSize = 10;
  recentHeights = appendToWindow(recentHeights, blockWithCounts.height, slidingWindowSize);
  recentTimestamps = appendToWindow(
    recentTimestamps,
    blockWithCounts.timestamp,
    slidingWindowSize
  );
  recentTxCounts = appendToWindow(recentTxCounts, blockWithCounts.txCount, slidingWindowSize);

  const cachePromises = [
    cacheBlock(redis, blockPayload),
    cacheTransactions(redis, transactions),
    cacheNetworkStats(redis, statsPayload),
    persistLastKnownHeight(redis, blockInfo.height)
  ];

  const cacheResults = await Promise.allSettled(cachePromises);

  cacheResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `[BlockPoller] Cache operation index=${index} failed: ${
          (result.reason as Error).message
        }`
      );
    }
  });

  if (redisPubClient) {
    try {
      await publishBlockEvents(redisPubClient, blockWithCounts, transactions, statsPayload);
    } catch (err) {
      // publishBlockEvents itself should not throw, but guard just in case.
      console.warn(
        `[BlockPoller] Unexpected error during publishBlockEvents: ${
          (err as Error).message
        }`
      );
    }
  } else {
    console.warn(
      '[BlockPoller] Redis pub client not initialised, skipping publishBlockEvents'
    );
  }

  console.log(
    `[BlockPoller] Block ${blockInfo.height} processed: ${transactions.length} transactions indexed`
  );
}

async function runPollerTick(
  client: GatewayHttpClient,
  redis: Redis,
  state: PollerState
): Promise<void> {
  try {
    const latestBlock = await withRetry(() => getLatestBlockInfo(client), {
      maxAttempts: 2,
      delayMs: 1000
    });

    const height = latestBlock.height;

    if (height === state.lastKnownHeight) {
      console.log(`[BlockPoller] No new block (height=${height})`);
      return;
    }

    // On a fresh start (no persisted height), process only the latest block to
    // avoid replaying the entire chain.
    if (state.lastKnownHeight === 0) {
      await processNewBlock(client, redis, latestBlock);
      state.lastKnownHeight = height;
      state.consecutiveErrors = 0;
      state.lastSuccessAt = Date.now();
      return;
    }

    if (height < state.lastKnownHeight) {
      console.warn(
        `[BlockPoller] Latest height (${height}) is below lastKnownHeight (${state.lastKnownHeight}); skipping`
      );
      return;
    }

    const diff = height - state.lastKnownHeight;
    if (diff > 5) {
      console.warn(
        `[BlockPoller] Height jumped by ${diff} — processing missed blocks from ${state.lastKnownHeight + 1} to ${height}`
      );
    }

    // Backfill any missed blocks sequentially, then process the latest block.
    for (let h = state.lastKnownHeight + 1; h <= height; h += 1) {
      const blockInfo =
        h === height
          ? latestBlock
          : await withRetry(() => getBlockInfoByHeight(client, h), {
              maxAttempts: 2,
              delayMs: 1000
            });

      await processNewBlock(client, redis, blockInfo);
      state.lastKnownHeight = h;
      state.consecutiveErrors = 0;
      state.lastSuccessAt = Date.now();
    }
  } catch (err) {
    state.consecutiveErrors += 1;
    console.error(
      `[BlockPoller] Poller tick error (consecutiveErrors=${state.consecutiveErrors}): ${
        (err as Error).message
      }`,
      err
    );

    if (state.consecutiveErrors >= 10) {
      console.warn(
        `[BlockPoller] Poller has encountered ${state.consecutiveErrors} consecutive errors and may be stuck`
      );
    }
  }
}

export function startBlockPoller(): NodeJS.Timeout {
  const gateArUrl = process.env.GATE_AR_URL;
  const redisUrl = process.env.REDIS_URL;

  if (!gateArUrl) {
    throw new Error('[BlockPoller] Missing required environment variable: GATE_AR_URL');
  }
  if (!redisUrl) {
    throw new Error('[BlockPoller] Missing required environment variable: REDIS_URL');
  }

  const pollIntervalMs =
    Number.parseInt(process.env.POLL_INTERVAL_MS ?? '', 10) || DEFAULT_POLL_INTERVAL_MS;

  gatewayClient = createGatewayHttpClient(gateArUrl);
  redisClient = createRedisClient(redisUrl);
  redisPubClient = createRedisClient(redisUrl);

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
        console.error(
          '[BlockPoller] Poller initialisation failed: missing required clients or state'
        );
        return;
      }

      await waitForRedisReady(redisClient);
      if (redisPubClient) {
        await waitForRedisReady(redisPubClient);
      }

      const initialHeight = await readLastKnownHeight(redisClient);
      pollerState.lastKnownHeight = initialHeight;

      console.log(
        `[BlockPoller] Starting. Last known height: ${pollerState.lastKnownHeight}`
      );

      pollerTickInProgress = true;
      try {
        await runPollerTick(gatewayClient, redisClient, pollerState);
      } finally {
        pollerTickInProgress = false;
      }
    } catch (err) {
      console.error(
        `[BlockPoller] Failed during initial poller tick: ${(err as Error).message}`,
        err
      );
    }
  })().catch((err) => {
    console.error(
      `[BlockPoller] Unhandled error in poller initialisation: ${(err as Error).message}`,
      err
    );
  });

  const interval = setInterval(() => {
    if (!gatewayClient || !redisClient || !pollerState) {
      console.warn(
        '[BlockPoller] Poller tick skipped because clients or state are not initialised'
      );
      return;
    }

    if (pollerTickInProgress) {
      console.warn(
        '[BlockPoller] Poller tick skipped because a previous tick is still running'
      );
      return;
    }

    pollerTickInProgress = true;

    runPollerTick(gatewayClient, redisClient, pollerState)
      .catch((err) => {
        console.error(
          `[BlockPoller] Unhandled error in poller tick: ${(err as Error).message}`,
          err
        );
      })
      .finally(() => {
        pollerTickInProgress = false;
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
