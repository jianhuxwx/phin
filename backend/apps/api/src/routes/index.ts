import type { FastifyInstance } from 'fastify';
import blocksRoutes from './blocks';
import transactionsRoutes from './transactions';
import walletsRoutes from './wallets';
import searchRoutes from './search';
import networkRoutes from './network';
import arnsRoutes from './arns';
import aoRoutes from './ao';
import previewRoutes from './preview';
import keysRoutes from './keys';
import wsRoutes from './ws';

interface RegisterRoutesOptions {
  enableWebsocket?: boolean;
}

export async function registerRoutes(
  app: FastifyInstance,
  options: RegisterRoutesOptions = {}
): Promise<void> {
  app.register(blocksRoutes, { prefix: '/v1' });
  app.register(transactionsRoutes, { prefix: '/v1' });
  app.register(walletsRoutes, { prefix: '/v1' });
  app.register(searchRoutes, { prefix: '/v1' });
  app.register(networkRoutes, { prefix: '/v1' });
  app.register(arnsRoutes, { prefix: '/v1' });
  app.register(aoRoutes, { prefix: '/v1' });
  app.register(previewRoutes, { prefix: '/v1' });
  app.register(keysRoutes, { prefix: '/v1' });

  if (options.enableWebsocket) {
    app.register(wsRoutes, { prefix: '/v1' });
  }
}
