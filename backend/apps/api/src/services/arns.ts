import type {
  ApiArnsDetail,
  ApiArnsHistoryEvent,
  ApiArnsRecord,
  ApiArnsUndername,
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
      if (
        this.gateway &&
        record.processId &&
        record.undernames.length < record.undernameCount
      ) {
        const liveRecords = await this.gateway.getArnsProcessRecords(record.processId);
        if (liveRecords.length > 0) {
          const indexedByUndername = new Map(
            record.undernames.map((undername) => [undername.undername, undername])
          );

          for (const liveRecord of liveRecords) {
            if (indexedByUndername.has(liveRecord.undername)) {
              continue;
            }

            const merged: ApiArnsUndername = {
              undername: liveRecord.undername,
              fullName: `${liveRecord.undername}.${record.name}`,
              targetId: liveRecord.targetId,
              targetKind: liveRecord.targetId ? 'transaction' : null,
              ttlSeconds: liveRecord.ttlSeconds,
              updatedAt: record.lastUpdatedAt,
              updateTxId: record.lastUpdateTxId
            };

            indexedByUndername.set(merged.undername, merged);
          }

          const undernames = Array.from(indexedByUndername.values()).sort((a, b) =>
            a.undername.localeCompare(b.undername)
          );

          return {
            ...record,
            undernameCount: Math.max(record.undernameCount, undernames.length),
            undernameLimitHit:
              record.undernameLimit > 0 &&
              Math.max(record.undernameCount, undernames.length) >= record.undernameLimit,
            undernames
          };
        }
      }

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
