import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const searchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/search', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/search/suggest', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default searchRoutes;

