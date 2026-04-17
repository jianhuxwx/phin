import { FastifyInstance } from 'fastify';

import { GatewayClient, GatewayDataSource } from '../clients/gateway';

declare module 'fastify' {
  interface FastifyInstance {
    gateway: GatewayDataSource;
  }
}

export async function registerGateway(
  app: FastifyInstance,
  urls: string[],
  existingGateway?: GatewayDataSource
): Promise<void> {
  app.decorate('gateway', existingGateway ?? new GatewayClient(urls));
}
