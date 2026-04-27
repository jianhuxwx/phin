import type {
  ApiArnsDetail,
  ApiArnsHistoryEvent,
  ApiArnsRecord,
  PaginatedResponse
} from '../contracts';

import type { GatewayDataSource } from '../clients/gateway';
import { ArnsRepository } from '../repositories/arns';
import { ApiHttpError } from '../lib/errors';

export class ArnsService {
  constructor(
    private readonly repository: ArnsRepository,
    private readonly gateway?: GatewayDataSource
  ) {}

  async list(options: {
    page: number;
    limit: number;
    ownerAddress?: string;
    query?: string;
  }): Promise<PaginatedResponse<ApiArnsRecord>> {
    return await this.repository.list(options);
  }

  async getByName(name: string): Promise<ApiArnsDetail> {
    const record = await this.repository.getByName(name);
    if (record) {
      return record;
    }

    if (this.gateway) {
      const liveResolution = await this.gateway.resolveArnsName(name);
      if (liveResolution) {
        const transaction = await this.gateway.getTransaction(liveResolution.txId);
        const registeredAtTimestamp =
          transaction?.block?.timestamp != null
            ? transaction.block.timestamp * 1000
            : liveResolution.resolvedAt ?? Date.now();

        return {
          name: liveResolution.name,
          resolvedUrl: `${liveResolution.name}.ar.io`,
          ownerAddress: transaction?.owner.address ?? '',
          transactionId: liveResolution.txId,
          registeredAt: new Date(registeredAtTimestamp).toISOString(),
          expiresAt: null,
          recordType: 'permanent',
          undernameLimit: liveResolution.undernameLimit,
          controllerAddress: null,
          processId: liveResolution.processId,
          targetId: liveResolution.txId,
          targetKind: 'transaction',
          ttlSeconds: liveResolution.ttlSeconds,
          registeredBlockHeight: transaction?.block?.height ?? null,
          lastUpdatedAt: new Date(registeredAtTimestamp).toISOString(),
          lastUpdateTxId: liveResolution.txId,
          purchasePrice: null,
          purchaseCurrency: null,
          undernameCount: 0,
          undernameLimitHit: false,
          daysRemaining: null,
          undernames: []
        };
      }
    }

    throw new ApiHttpError(404, 'ArNS record not found');
  }

  async listByOwner(ownerAddress: string): Promise<ApiArnsRecord[]> {
    return await this.repository.listByOwner(ownerAddress);
  }

  async getHistory(
    name: string,
    options: { page: number; limit: number }
  ): Promise<PaginatedResponse<ApiArnsHistoryEvent>> {
    return await this.repository.getHistory(name, options);
  }

  async countByOwner(ownerAddress: string): Promise<number> {
    return await this.repository.countByOwner(ownerAddress);
  }
}
