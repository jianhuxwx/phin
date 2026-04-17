import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sendError } from '../lib/errors';

const keysRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/keys', async (_request, reply) => {
    return sendError(reply, 501, 'API key management is not implemented yet');
  });

  app.get('/keys/me', async (_request, reply) => {
    return sendError(reply, 501, 'API key management is not implemented yet');
  });

  app.delete('/keys/:id', async (_request, reply) => {
    return sendError(reply, 501, 'API key management is not implemented yet');
  });
};

export default keysRoutes;
