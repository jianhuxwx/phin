import type { ApiTransactionDetail, ApiTransactionStatus } from '../contracts';

import { CacheRepository } from '../repositories/cache';
import type { GatewayDataSource } from '../clients/gateway';
import { ApiHttpError } from '../lib/errors';
import { toTransactionDetail } from './serializers';

export class TransactionsService {
  constructor(
    private readonly cache: CacheRepository,
    private readonly gateway: GatewayDataSource
  ) {}

  async getById(id: string): Promise<ApiTransactionDetail> {
    const cached = await this.cache.getTransaction(id);
    if (cached) {
      return toTransactionDetail(cached);
    }

    const transaction = await this.gateway.getTransaction(id);
    if (!transaction) {
      throw new ApiHttpError(404, 'Transaction not found');
    }

    return toTransactionDetail(transaction);
  }

  async getStatus(id: string): Promise<ApiTransactionStatus> {
    const cached = await this.cache.getTransaction(id);
    const transaction = cached ?? (await this.gateway.getTransaction(id));

    if (!transaction) {
      throw new ApiHttpError(404, 'Transaction not found');
    }

    return {
      id,
      confirmed: Boolean(transaction.block),
      blockHeight: transaction.block?.height ?? null,
      blockTimestamp: transaction.block?.timestamp ?? null
    };
  }
}
