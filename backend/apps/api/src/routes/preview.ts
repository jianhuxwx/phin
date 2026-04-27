import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sendError } from '../lib/errors';

const previewRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/preview/:txid', async (_request, reply) => {
    return sendError(reply, 501, 'Preview endpoint is not implemented yet');
  });
};

export default previewRoutes;
