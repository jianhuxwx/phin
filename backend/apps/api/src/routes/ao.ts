import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sendError } from '../lib/errors';

const aoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/ao/processes', async (_request, reply) => {
    return sendError(reply, 501, 'AO endpoints are not indexed yet');
  });

  app.get('/ao/processes/:id', async (_request, reply) => {
    return sendError(reply, 501, 'AO endpoints are not indexed yet');
  });

  app.get('/ao/processes/:id/messages', async (_request, reply) => {
    return sendError(reply, 501, 'AO endpoints are not indexed yet');
  });
};

export default aoRoutes;
