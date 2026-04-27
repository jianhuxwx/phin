import { FastifyInstance } from 'fastify';

import { CacheRepository } from '../repositories/cache';
import { ArnsRepository } from '../repositories/arns';
import { ArnsService } from './arns';
import { BlocksService } from './blocks';
import { NetworkService } from './network';
import { SearchService } from './search';
import { TransactionsService } from './transactions';
import { WalletsService } from './wallets';

export function createServices(app: FastifyInstance) {
  const cache = new CacheRepository(app.redis);
  const arnsRepository = new ArnsRepository(app.db);
  const arns = new ArnsService(arnsRepository, app.gateway);
  const blocks = new BlocksService(cache, app.gateway);
  const transactions = new TransactionsService(cache, app.gateway);
  const wallets = new WalletsService(app.gateway, arns);
  const network = new NetworkService(cache, app.gateway);
  const search = new SearchService(transactions, wallets, blocks, arns);

  return {
    arns,
    blocks,
    network,
    search,
    transactions,
    wallets
  };
}
