import { FastifyInstance } from 'fastify';
import { createRedisClient } from 'phin-cache';

declare module 'fastify' {
  interface FastifyInstance {
    redis: ReturnType<typeof createRedisClient>;
  }
}

export async function registerRedis(app: FastifyInstance, redisUrl: string): Promise<void> {
  const client = createRedisClient(redisUrl);
  app.decorate('redis', client);

  app.addHook('onClose', async () => {
    client.disconnect();
  });
}

