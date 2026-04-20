import type { SearchResult } from '../contracts';

import { ApiHttpError } from '../lib/errors';
import { ArnsService } from './arns';
import { BlocksService } from './blocks';
import { TransactionsService } from './transactions';
import { WalletsService } from './wallets';

export type QueryType =
  | 'transaction_or_wallet'
  | 'block_id'
  | 'block_height'
  | 'arns'
  | 'keyword';

const TX_OR_WALLET_PATTERN = /^[a-zA-Z0-9_-]{43}$/;
const BLOCK_ID_PATTERN = /^[a-zA-Z0-9_-]{44,128}$/;
const BLOCK_HEIGHT_PATTERN = /^\d+$/;
const ARNS_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,50}$/;

export function detectQueryType(query: string): QueryType {
  const trimmed = query.trim();

  if (TX_OR_WALLET_PATTERN.test(trimmed)) {
    return 'transaction_or_wallet';
  }

  if (BLOCK_ID_PATTERN.test(trimmed)) {
    return 'block_id';
  }

  if (BLOCK_HEIGHT_PATTERN.test(trimmed)) {
    return 'block_height';
  }

  if (!trimmed.includes(' ') && ARNS_PATTERN.test(trimmed)) {
    return 'arns';
  }

  return 'keyword';
}

export class SearchService {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly walletsService: WalletsService,
    private readonly blocksService: BlocksService,
    private readonly arnsService: ArnsService
  ) {}

  async resolve(query: string): Promise<SearchResult> {
    const trimmed = query.trim();
    const queryType = detectQueryType(trimmed);

    if (queryType === 'block_height') {
      try {
        const height = Number(trimmed);
        const block = await this.blocksService.getByHeight(height);
        return {
          type: 'block',
          query: trimmed,
          target: trimmed,
          detail: block as unknown as Record<string, unknown>
        };
      } catch (error) {
        if (!(error instanceof ApiHttpError)) {
          throw error;
        }
      }
    }

    if (queryType === 'block_id') {
      try {
        const block = await this.blocksService.getById(trimmed);
        return {
          type: 'block',
          query: trimmed,
          target: block.id,
          detail: block as unknown as Record<string, unknown>
        };
      } catch (error) {
        if (!(error instanceof ApiHttpError)) {
          throw error;
        }
      }
    }

    if (queryType === 'transaction_or_wallet') {
      try {
        const transaction = await this.transactionsService.getById(trimmed);
        return {
          type: 'transaction',
          query: trimmed,
          target: transaction.id,
          detail: transaction as unknown as Record<string, unknown>
        };
      } catch (error) {
        if (!(error instanceof ApiHttpError)) {
          throw error;
        }
      }

      const wallet = await this.walletsService.getSummary(trimmed);
      if (wallet.hasActivity) {
        return {
          type: 'wallet',
          query: trimmed,
          target: wallet.address,
          detail: wallet as unknown as Record<string, unknown>
        };
      }
    }

    if (queryType === 'arns') {
      try {
        const record = await this.arnsService.getByName(trimmed);
        return {
          type: 'arns',
          query: trimmed,
          target: record.name,
          detail: record as unknown as Record<string, unknown>
        };
      } catch (error) {
        if (!(error instanceof ApiHttpError)) {
          throw error;
        }
      }
    }

    if (queryType === 'keyword') {
      return {
        type: 'unsupported',
        query: trimmed,
        target: null
      };
    }

    return {
      type: 'not_found',
      query: trimmed,
      target: null
    };
  }

  async suggest(query: string) {
    const result = await this.arnsService.list({
      page: 1,
      limit: 10,
      query
    });

    return {
      data: result.data.map((record) => record.name)
    };
  }
}
