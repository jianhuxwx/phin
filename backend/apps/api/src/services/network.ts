import type { GatewayStatus, NetworkStats } from '../contracts';

import { CacheRepository } from '../repositories/cache';
import type { GatewayDataSource } from '../clients/gateway';

export class NetworkService {
  constructor(
    private readonly cache: CacheRepository,
    private readonly gateway: GatewayDataSource
  ) {}

  private isStaleCachedStats(stats: NetworkStats | null): boolean {
    if (!stats) {
      return false;
    }

    return stats.blockHeight > 0 && stats.weaveSize === '0';
  }

  async getStats(): Promise<NetworkStats> {
    const cached = await this.cache.getNetworkStats();
    if (cached && !this.isStaleCachedStats(cached)) {
      return cached;
    }

    const info = await this.gateway.getNetworkInfo();
    return {
      blockHeight: info.height,
      weaveSize: info.weaveSize,
      lastBlockTimestamp: 0,
      approximateTPS: 0,
      lastBlockTxCount: 0,
      updatedAt: Date.now()
    };
  }

  async getGateways(): Promise<GatewayStatus[]> {
    const cached = await this.cache.getGatewayStatuses();
    if (cached.length > 0) {
      return cached;
    }

    return await this.gateway.getGatewayStatuses();
  }
}
