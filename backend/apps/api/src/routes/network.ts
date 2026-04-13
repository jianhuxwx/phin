import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const networkRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/network/stats', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/network/gateways', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/network/mempool', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default networkRoutes;

