import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const aoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/ao/processes', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/ao/processes/:id', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/ao/processes/:id/messages', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default aoRoutes;

