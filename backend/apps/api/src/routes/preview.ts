import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const previewRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/preview/:txid', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default previewRoutes;

