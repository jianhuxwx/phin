import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { sendError } from '../lib/errors';
import { getPagination } from '../lib/pagination';
import { getArnsByNameSchema, getArnsHistorySchema, listArnsSchema } from '../schemas/arns';
import { createServices } from '../services/factory';

const arnsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/arns', { schema: listArnsSchema }, async (request) => {
    const { arns } = createServices(app);
    const query = request.query as {
      page?: number;
      limit?: number;
      ownerAddress?: string;
      q?: string;
    };
    const pagination = getPagination(query);

    return await arns.list({
      page: pagination.page,
      limit: pagination.limit,
      ownerAddress: query.ownerAddress,
      query: query.q
    });
  });

  app.get('/arns/:name', { schema: getArnsByNameSchema }, async (request) => {
    const { arns } = createServices(app);
    const params = request.params as { name: string };
    return await arns.getByName(params.name);
  });

  app.get('/arns/:name/history', { schema: getArnsHistorySchema }, async (_request, reply) => {
    return sendError(reply, 501, 'ArNS history is not indexed yet');
  });
};

export default arnsRoutes;
