import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { getTransactionSchema, getTransactionStatusSchema } from '../schemas/transactions';
import { createServices } from '../services/factory';

const transactionsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/transactions/:id', { schema: getTransactionSchema }, async (request) => {
    const { transactions } = createServices(app);
    const params = request.params as { id: string };
    return await transactions.getById(params.id);
  });

  app.get('/transactions/:id/status', { schema: getTransactionStatusSchema }, async (request) => {
    const { transactions } = createServices(app);
    const params = request.params as { id: string };
    return await transactions.getStatus(params.id);
  });
};

export default transactionsRoutes;
