import type { ApiBlockDetail, ApiBlockSummary, PaginatedResponse } from '../contracts';

import { CacheRepository } from '../repositories/cache';
import type { GatewayDataSource } from '../clients/gateway';
import { ApiHttpError } from '../lib/errors';
import { toBlockDetail, toBlockSummary, toTransactionSummary } from './serializers';

export class BlocksService {
  constructor(
    private readonly cache: CacheRepository,
    private readonly gateway: GatewayDataSource
  ) {}

  private isStaleCachedBlock(block: {
    weaveSize?: string;
    reward?: string;
    txCount?: number;
  } | null): boolean {
    if (!block) {
      return false;
    }

    const hasTransactions = typeof block.txCount === 'number' && block.txCount > 0;
    return hasTransactions && block.weaveSize === '0' && block.reward === '0';
  }

  async list(page: number, limit: number): Promise<PaginatedResponse<ApiBlockSummary>> {
    if (page === 1) {
      const cached = await this.cache.listRecentBlocks(limit);
      const hasStaleEntries = cached.some((block) => this.isStaleCachedBlock(block));
      const hasFullPage = cached.length >= limit;
      if (hasFullPage && !hasStaleEntries) {
        return {
          data: cached.map(toBlockSummary),
          pagination: {
            page,
            limit,
            hasNextPage: cached.length === limit
          }
        };
      }
    }

    const blocks = await this.gateway.getLatestBlocksPage(page, limit);

    return {
      data: blocks.data.map(toBlockSummary),
      pagination: {
        page,
        limit,
        hasNextPage: blocks.hasNextPage,
        nextCursor: blocks.nextCursor
      }
    };
  }

  async getById(id: string): Promise<ApiBlockDetail> {
    const cached = await this.cache.getBlockById(id);
    if (cached && !this.isStaleCachedBlock(cached)) {
      return toBlockDetail(cached);
    }

    const block = await this.gateway.getBlockById(id);
    if (!block) {
      throw new ApiHttpError(404, 'Block not found');
    }

    return toBlockDetail(block);
  }

  async getByHeight(height: number): Promise<ApiBlockDetail> {
    const cached = await this.cache.getBlockByHeight(height);
    if (cached && !this.isStaleCachedBlock(cached)) {
      return toBlockDetail(cached);
    }

    const block = await this.gateway.getBlockByHeight(height);
    if (!block) {
      throw new ApiHttpError(404, 'Block not found');
    }

    return toBlockDetail(block);
  }

  async getTransactions(id: string, page: number, limit: number, blockHeight?: number) {
    const cached = await this.cache.getBlockById(id);
    const cachedTransactions = cached?.transactions ?? [];
    const shouldUseCachedTransactions =
      cached != null && (cachedTransactions.length > 0 || cached.txCount === 0);

    if (shouldUseCachedTransactions) {
      const start = (page - 1) * limit;
      const end = start + limit;
      const transactions = cachedTransactions.slice(start, end).map(toTransactionSummary);
      return {
        data: transactions,
        pagination: {
          page,
          limit,
          hasNextPage: cachedTransactions.length > end
        }
      };
    }

    const transactionsPage = await this.gateway.getBlockTransactions(
      id,
      page,
      limit,
      blockHeight
    );
    return {
      data: transactionsPage.data.map(toTransactionSummary),
      pagination: {
        page,
        limit,
        hasNextPage: transactionsPage.hasNextPage,
        nextCursor: transactionsPage.nextCursor
      }
    };
  }
}
