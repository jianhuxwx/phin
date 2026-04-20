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

  async list(page: number, limit: number): Promise<PaginatedResponse<ApiBlockSummary>> {
    if (page === 1) {
      const cached = await this.cache.listRecentBlocks(limit);
      if (cached.length > 0) {
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
    if (cached) {
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
    if (cached) {
      return toBlockDetail(cached);
    }

    const block = await this.gateway.getBlockByHeight(height);
    if (!block) {
      throw new ApiHttpError(404, 'Block not found');
    }

    return toBlockDetail(block);
  }

  async getTransactions(id: string, limit: number) {
    const cached = await this.cache.getBlockById(id);
    if (cached) {
      const transactions = (cached.transactions ?? []).slice(0, limit).map(toTransactionSummary);
      return {
        data: transactions,
        pagination: {
          page: 1,
          limit,
          hasNextPage: (cached.transactions?.length ?? 0) > limit
        }
      };
    }

    const page = await this.gateway.getBlockTransactions(id, limit);
    return {
      data: page.data.map(toTransactionSummary),
      pagination: {
        page: 1,
        limit,
        hasNextPage: page.hasNextPage,
        nextCursor: page.nextCursor
      }
    };
  }
}
