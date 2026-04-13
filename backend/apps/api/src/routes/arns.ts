import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const arnsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/arns', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/arns/:name', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/arns/:name/history', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default arnsRoutes;

