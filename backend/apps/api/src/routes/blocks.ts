import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const blocksRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/blocks', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/blocks/:id', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/blocks/:id/transactions', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default blocksRoutes;

