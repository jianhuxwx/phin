import type {
  ApiArnsDetail,
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

  private splitUndername(name: string): { undername: string; parentName: string } | null {
    const separatorIndex = name.lastIndexOf('.');
    if (separatorIndex <= 0 || separatorIndex === name.length - 1) {
      return null;
    }

    return {
      undername: name.slice(0, separatorIndex),
      parentName: name.slice(separatorIndex + 1)
    };
  }

  private async withLiveAntData(record: ApiArnsDetail): Promise<ApiArnsDetail> {
    if (!this.gateway || record.recordType === 'undername') {
      return record;
    }

    const liveResolution = record.processId ? null : await this.gateway.resolveArnsName(record.name);
    const processId = record.processId ?? liveResolution?.processId ?? null;
    if (!processId) {
      return record;
    }

    const liveInfo =
      this.gateway.getArnsProcessInfo != null
        ? await this.gateway.getArnsProcessInfo(processId)
        : {
            ownerAddress: null,
            controllerAddresses: [],
            records: await this.gateway.getArnsProcessRecords(processId)
          };

    if (!liveInfo) {
      return {
        ...record,
        processId,
        undernameLimit: Math.max(record.undernameLimit, liveResolution?.undernameLimit ?? 0)
      };
    }

    const indexedByUndername = new Map(
      record.undernames.map((undername) => [undername.undername, undername])
    );

    for (const liveRecord of liveInfo.records) {
      const existing = indexedByUndername.get(liveRecord.undername);
      const merged: ApiArnsUndername = {
        undername: liveRecord.undername,
        fullName: `${liveRecord.undername}.${record.name}`,
        targetId: liveRecord.targetId,
        targetKind: liveRecord.targetId ? 'transaction' : null,
        ttlSeconds: liveRecord.ttlSeconds,
        ownerAddress: liveRecord.ownerAddress,
        displayName: liveRecord.displayName,
        logo: liveRecord.logo,
        description: liveRecord.description,
        keywords: liveRecord.keywords,
        updatedAt: existing?.updatedAt ?? record.lastUpdatedAt,
        updateTxId: existing?.updateTxId ?? liveRecord.targetId ?? record.lastUpdateTxId
      };

      indexedByUndername.set(merged.undername, merged);
    }

    const undernames = Array.from(indexedByUndername.values()).sort((a, b) =>
      a.undername.localeCompare(b.undername)
    );
    const undernameCount = Math.max(record.undernameCount, undernames.length);
    const undernameLimit = Math.max(record.undernameLimit, liveResolution?.undernameLimit ?? 0);

    return {
      ...record,
      processId,
      undernameLimit,
      processOwnerAddress: liveInfo.ownerAddress,
      controllerAddresses: liveInfo.controllerAddresses,
      targetId: record.targetId ?? liveResolution?.txId ?? null,
      ttlSeconds: record.ttlSeconds ?? liveResolution?.ttlSeconds ?? null,
      undernameCount,
      undernameLimitHit: undernameLimit > 0 && undernameCount >= undernameLimit,
      undernames
    };
  }

  private async getLiveUndernameByName(name: string): Promise<ApiArnsDetail | null> {
    if (!this.gateway) {
      return null;
    }

    const parts = this.splitUndername(name);
    if (!parts) {
      return null;
    }

    const parentResolution = await this.gateway.resolveArnsName(parts.parentName);
    if (!parentResolution?.processId) {
      return null;
    }

    const liveInfo =
      this.gateway.getArnsProcessInfo != null
        ? await this.gateway.getArnsProcessInfo(parentResolution.processId)
        : {
            ownerAddress: null,
            controllerAddresses: [],
            records: await this.gateway.getArnsProcessRecords(parentResolution.processId)
          };

    const liveRecord = liveInfo?.records.find(
      (record) => record.undername.toLowerCase() === parts.undername.toLowerCase()
    );
    if (!liveRecord) {
      return null;
    }

    const parentTransaction = await this.gateway.getTransaction(parentResolution.txId);
    const parentTimestamp =
      parentTransaction?.block?.timestamp != null
        ? parentTransaction.block.timestamp * 1000
        : parentResolution.resolvedAt ?? Date.now();
    const timestamp = new Date(parentTimestamp).toISOString();

    return {
      name,
      resolvedUrl: `${parts.undername}_${parts.parentName}.ar.io`,
      ownerAddress:
        liveRecord.ownerAddress ??
        liveInfo?.ownerAddress ??
        parentTransaction?.owner.address ??
        '',
      transactionId: liveRecord.targetId ?? parentResolution.txId,
      registeredAt: timestamp,
      expiresAt: null,
      recordType: 'undername',
      undernameLimit: 0,
      controllerAddress: null,
      processOwnerAddress: liveInfo?.ownerAddress ?? null,
      controllerAddresses: liveInfo?.controllerAddresses ?? [],
      processId: parentResolution.processId,
      targetId: liveRecord.targetId,
      targetKind: liveRecord.targetId ? 'transaction' : null,
      ttlSeconds: liveRecord.ttlSeconds,
      registeredBlockHeight: parentTransaction?.block?.height ?? null,
      lastUpdatedAt: timestamp,
      lastUpdateTxId: liveRecord.targetId ?? parentResolution.txId,
      purchasePrice: null,
      purchaseCurrency: null,
      undernameCount: 0,
      undernameLimitHit: false,
      daysRemaining: null,
      undernames: []
    };
  }

  async getByName(name: string): Promise<ApiArnsDetail> {
    const record = await this.repository.getByName(name);
    if (record) {
      return await this.withLiveAntData(record);
    }

    if (this.gateway) {
      const liveResolution = await this.gateway.resolveArnsName(name);
      if (liveResolution) {
        const transaction = await this.gateway.getTransaction(liveResolution.txId);
        const registeredAtTimestamp =
          transaction?.block?.timestamp != null
            ? transaction.block.timestamp * 1000
            : liveResolution.resolvedAt ?? Date.now();

        return await this.withLiveAntData({
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
          processOwnerAddress: null,
          controllerAddresses: [],
          undernameCount: 0,
          undernameLimitHit: false,
          daysRemaining: null,
          undernames: []
        });
      }

      const liveUndername = await this.getLiveUndernameByName(name);
      if (liveUndername) {
        return liveUndername;
      }
    }

    throw new ApiHttpError(404, 'ArNS record not found');
  }

  async listByOwner(ownerAddress: string): Promise<ApiArnsRecord[]> {
    return await this.repository.listByOwner(ownerAddress);
  }

  async countByOwner(ownerAddress: string): Promise<number> {
    return await this.repository.countByOwner(ownerAddress);
  }
}
