import type Redis from 'ioredis';
import { PubSubChannels } from 'phin-cache';
import type {
  ArweaveBlock,
  ArweaveTransaction,
  GatewayStatus,
  NetworkStats
} from 'phin-types';

const RECENT_TX_CAP = 5;

type PublishableBlock = ArweaveBlock & {
  height: number;
  id: string;
  timestamp: number;
  txCount?: number;
  weaveSizeDelta?: number | string;
  totalWeaveSize?: number | string;
  weaveSize?: number | string;
  reward?: string | number;
  miner?: string;
};

type PublishableTransaction = ArweaveTransaction & {
  id: string;
  data?: {
    size?: number | string | null;
  } | null;
};

function ensureRedis(redis: Redis | null | undefined): Redis {
  if (!redis) {
    throw new Error('[Publisher] Redis client is required before publishing events');
  }
  return redis;
}

async function publishPayload(redis: Redis, channel: string, payload: unknown): Promise<void> {
  try {
    const serialized = JSON.stringify(payload);
    await redis.publish(channel, serialized);
  } catch (err) {
    console.error(
      `[Publisher] Failed to publish payload on channel ${channel}`,
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  }
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return fallback;
}

function hasDataPayload(tx: PublishableTransaction): boolean {
  const size = tx?.data?.size;
  const numericSize = coerceNumber(size, 0);
  return numericSize > 0;
}

export async function publishNewBlock(
  redis: Redis | null,
  block: PublishableBlock,
  transactions: PublishableTransaction[]
): Promise<void> {
  const client = ensureRedis(redis);
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  if (!block || typeof block !== 'object') {
    throw new Error('[Publisher] publishNewBlock requires a block payload');
  }

  if (
    typeof block.height !== 'number' ||
    typeof block.id !== 'string' ||
    typeof block.timestamp !== 'number'
  ) {
    throw new Error(
      '[Publisher] publishNewBlock received a block missing required fields (height/id/timestamp)'
    );
  }

  const payload = {
    type: 'new_block' as const,
    data: {
      height: block.height,
      id: block.id,
      timestamp: block.timestamp,
      txCount: coerceNumber(block.txCount ?? safeTransactions.length ?? 0),
      weaveSizeDelta: coerceNumber(block.weaveSizeDelta, 0),
      totalWeaveSize: coerceNumber(block.totalWeaveSize ?? block.weaveSize, 0),
      reward: coerceString(block.reward, '0'),
      miner: block.miner ?? 'unknown',
      recentTransactions: safeTransactions.slice(0, RECENT_TX_CAP)
    }
  };

  await publishPayload(client, PubSubChannels.NEW_BLOCK, payload);
}

export async function publishStatsUpdate(
  redis: Redis | null,
  stats: NetworkStats & {
    blockHeight: number;
    weaveSize: number;
    approximateTPS: number;
    lastBlockTimestamp: number;
  }
): Promise<void> {
  const client = ensureRedis(redis);

  const payload = {
    type: 'stats_update' as const,
    data: {
      blockHeight: stats.blockHeight,
      weaveSize: stats.weaveSize,
      approximateTPS: stats.approximateTPS,
      lastBlockTimestamp: stats.lastBlockTimestamp
    }
  };

  await publishPayload(client, PubSubChannels.STATS_UPDATE, payload);
}

export async function publishGatewayStatus(
  redis: Redis | null,
  statuses: GatewayStatus[]
): Promise<void> {
  const client = ensureRedis(redis);

  if (!Array.isArray(statuses) || statuses.length === 0) {
    console.warn('[Publisher] publishGatewayStatus received an empty payload');
  }

  const payload = {
    type: 'gateway_status' as const,
    timestamp: Date.now(),
    data: statuses
  };

  await publishPayload(client, PubSubChannels.GATEWAY_STATUS, payload);
}

export async function publishNewTransaction(
  redis: Redis | null,
  transaction: PublishableTransaction
): Promise<void> {
  const client = ensureRedis(redis);

  if (!transaction || typeof transaction !== 'object') {
    throw new Error('[Publisher] publishNewTransaction requires a transaction payload');
  }

  if (!hasDataPayload(transaction)) {
    return;
  }

  const payload = {
    type: 'new_transaction' as const,
    data: transaction
  };

  await publishPayload(client, PubSubChannels.NEW_TRANSACTION, payload);
}

