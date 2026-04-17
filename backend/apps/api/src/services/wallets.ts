import type { ApiWalletFile, ApiWalletSummary, PaginatedResponse } from '../contracts';

import type { GatewayDataSource } from '../clients/gateway';
import { ArnsService } from './arns';
import { toTransactionSummary } from './serializers';

export class WalletsService {
  constructor(
    private readonly gateway: GatewayDataSource,
    private readonly arnsService: ArnsService
  ) {}

  async getSummary(address: string): Promise<ApiWalletSummary> {
    const [wallet, arnsCount, transactions] = await Promise.all([
      this.gateway.getWallet(address),
      this.arnsService.countByOwner(address),
      this.gateway.getTransactionsByOwner(address, 1, 1)
    ]);

    return {
      address,
      balance: wallet.balance,
      lastTransactionId: wallet.lastTransactionId,
      arnsCount,
      hasActivity: arnsCount > 0 || transactions.data.length > 0 || wallet.balance !== '0'
    };
  }

  async getTransactions(address: string, page: number, limit: number) {
    const transactions = await this.gateway.getTransactionsByOwner(address, page, limit);
    return {
      data: transactions.data.map(toTransactionSummary),
      pagination: {
        page,
        limit,
        hasNextPage: transactions.hasNextPage,
        nextCursor: transactions.nextCursor
      }
    };
  }

  async getFiles(address: string, page: number, limit: number): Promise<PaginatedResponse<ApiWalletFile>> {
    const pageResult = await this.gateway.getTransactionsByOwner(address, page, limit * 2);
    const files = pageResult.data
      .filter((transaction) => Number(transaction.data?.size ?? 0) > 0)
      .slice(0, limit)
      .map((transaction) => toTransactionSummary(transaction));

    return {
      data: files,
      pagination: {
        page,
        limit,
        hasNextPage: pageResult.hasNextPage || files.length === limit
      }
    };
  }

  async getArns(address: string) {
    return await this.arnsService.listByOwner(address);
  }
}
