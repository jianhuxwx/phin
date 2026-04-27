import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import {
  getWalletArnsSchema,
  getWalletFilesSchema,
  getWalletSchema,
  getWalletTransactionsSchema
} from '../schemas/wallets';
import { getPagination } from '../lib/pagination';
import { createServices } from '../services/factory';

const walletsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/wallets/:address', { schema: getWalletSchema }, async (request) => {
    const { wallets } = createServices(app);
    const params = request.params as { address: string };
    return await wallets.getSummary(params.address);
  });

  app.get(
    '/wallets/:address/transactions',
    { schema: getWalletTransactionsSchema },
    async (request) => {
      const { wallets } = createServices(app);
      const params = request.params as { address: string };
      const query = request.query as { page?: number; limit?: number };
      const pagination = getPagination(query);
      return await wallets.getTransactions(params.address, pagination.page, pagination.limit);
    }
  );

  app.get('/wallets/:address/files', { schema: getWalletFilesSchema }, async (request) => {
    const { wallets } = createServices(app);
    const params = request.params as { address: string };
    const query = request.query as { page?: number; limit?: number };
    const pagination = getPagination(query);
    return await wallets.getFiles(params.address, pagination.page, pagination.limit);
  });

  app.get('/wallets/:address/arns', { schema: getWalletArnsSchema }, async (request) => {
    const { wallets } = createServices(app);
    const params = request.params as { address: string };
    return await wallets.getArns(params.address);
  });
};

export default walletsRoutes;
