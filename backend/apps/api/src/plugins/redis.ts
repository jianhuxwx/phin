import type { FastifyInstance } from 'fastify';
import { createRedisClient } from 'phin-cache';

declare module 'fastify' {
  interface FastifyInstance {
    redis: ReturnType<typeof createRedisClient>;
  }
}

export async function registerRedis(
  app: FastifyInstance,
  redisUrl: string,
  existingClient?: ReturnType<typeof createRedisClient>
): Promise<void> {
  const client = existingClient ?? createRedisClient(redisUrl);
  app.decorate('redis', client);

  if (!existingClient) {
    app.addHook('onClose', async () => {
      client.disconnect();
    });
  }
}
