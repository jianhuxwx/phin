import type Redis from 'ioredis';

export interface CachedBlockSummary {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  weaveSize: string;
  reward: string;
}

export interface CachedBlockDetail extends CachedBlockSummary {
  blockSize?: string;
  previousBlock?: string;
  indexedAt?: number;
  transactions: any[];
}

export interface CachedNetworkStats {
  blockHeight: number;
  weaveSize: string;
  lastBlockTimestamp: number;
  approximateTPS: number;
  lastBlockTxCount: number;
  updatedAt: number;
}

export interface CachedGatewayStatus {
  url: string;
  alive: boolean;
  latencyMs: number;
  blockHeight: number | null;
  lastCheckedAt: number;
  consecutiveFailures: number;
  status: 'healthy' | 'degraded' | 'down';
  error: string | null;
}

const RECENT_BLOCKS_KEY = 'blocks:recent';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class CacheRepository {
  constructor(private readonly redis: Redis) {}

  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.warn(`[CacheRepository] Redis GET failed for ${key}`, error);
      return null;
    }
  }

  private async safeLrange(key: string, start: number, end: number): Promise<string[]> {
    try {
      return await this.redis.lrange(key, start, end);
    } catch (error) {
      console.warn(`[CacheRepository] Redis LRANGE failed for ${key}`, error);
      return [];
    }
  }

  async listRecentBlocks(limit: number): Promise<CachedBlockSummary[]> {
    const values = await this.safeLrange(RECENT_BLOCKS_KEY, 0, Math.max(limit - 1, 0));
    return values
      .map((value) => safeParse<CachedBlockSummary>(value))
      .filter((value): value is CachedBlockSummary => value !== null);
  }

  async getBlockById(id: string): Promise<CachedBlockDetail | null> {
    return safeParse<CachedBlockDetail>(await this.safeGet(`block:${id}`));
  }

  async getBlockByHeight(height: number): Promise<CachedBlockDetail | null> {
    return safeParse<CachedBlockDetail>(await this.safeGet(`block:height:${height}`));
  }

  async getTransaction(id: string): Promise<any | null> {
    return safeParse<any>(await this.safeGet(`tx:${id}`));
  }

  async getNetworkStats(): Promise<CachedNetworkStats | null> {
    return safeParse<CachedNetworkStats>(await this.safeGet('network:stats'));
  }

  async getGatewayStatuses(): Promise<CachedGatewayStatus[]> {
    const value = await this.safeGet('network:gateways');
    const parsed = safeParse<CachedGatewayStatus[]>(value);
    return parsed ?? [];
  }
}
