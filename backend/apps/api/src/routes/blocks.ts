import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import {
  getBlockByIdSchema,
  getBlockByHeightSchema,
  getBlockTransactionsSchema,
  listBlocksSchema
} from '../schemas/blocks';
import { getPagination } from '../lib/pagination';
import { createServices } from '../services/factory';

const blocksRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/blocks', { schema: listBlocksSchema }, async (request) => {
    const { blocks } = createServices(app);
    const query = request.query as { page?: number; limit?: number };
    const pagination = getPagination(query);
    return await blocks.list(pagination.page, pagination.limit);
  });

  app.get('/blocks/height/:height', { schema: getBlockByHeightSchema }, async (request) => {
    const { blocks } = createServices(app);
    const params = request.params as { height: number };
    return await blocks.getByHeight(Number(params.height));
  });

  app.get('/blocks/:id', { schema: getBlockByIdSchema }, async (request) => {
    const { blocks } = createServices(app);
    const params = request.params as { id: string };
    return await blocks.getById(params.id);
  });

  app.get('/blocks/:id/transactions', { schema: getBlockTransactionsSchema }, async (request) => {
    const { blocks } = createServices(app);
    const params = request.params as { id: string };
    const query = request.query as { page?: number; limit?: number; height?: number };
    const pagination = getPagination(query);
    return await blocks.getTransactions(
      params.id,
      pagination.page,
      pagination.limit,
      query.height != null ? Number(query.height) : undefined
    );
  });
};

export default blocksRoutes;
