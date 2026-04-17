import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { sendError } from '../lib/errors';
import {
  networkGatewaysSchema,
  networkMempoolSchema,
  networkStatsSchema
} from '../schemas/network';
import { createServices } from '../services/factory';

const networkRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/network/stats', { schema: networkStatsSchema }, async () => {
    const { network } = createServices(app);
    return await network.getStats();
  });

  app.get('/network/gateways', { schema: networkGatewaysSchema }, async () => {
    const { network } = createServices(app);
    return await network.getGateways();
  });

  app.get('/network/mempool', { schema: networkMempoolSchema }, async (_request, reply) => {
    return sendError(reply, 501, 'Mempool endpoint is not indexed yet');
  });
};

export default networkRoutes;
