import type { GatewayStatus, NetworkStats } from '../contracts';

import { CacheRepository } from '../repositories/cache';
import type { GatewayDataSource } from '../clients/gateway';

export class NetworkService {
  constructor(
    private readonly cache: CacheRepository,
    private readonly gateway: GatewayDataSource
  ) {}

  async getStats(): Promise<NetworkStats> {
    const cached = await this.cache.getNetworkStats();
    if (cached) {
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
    return await this.cache.getGatewayStatuses();
  }
}
