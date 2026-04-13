import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const keysRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/keys', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/keys/me', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.delete('/keys/:id', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default keysRoutes;

