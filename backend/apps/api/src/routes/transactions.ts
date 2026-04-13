import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const transactionsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/transactions/:id', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/transactions/:id/status', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default transactionsRoutes;

