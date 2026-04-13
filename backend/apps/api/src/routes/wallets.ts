import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const walletsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/wallets/:address', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/wallets/:address/transactions', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/wallets/:address/files', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });

  app.get('/wallets/:address/arns', async (request, reply) => {
    reply.status(501).send({ message: 'Not implemented yet' });
  });
};

export default walletsRoutes;

