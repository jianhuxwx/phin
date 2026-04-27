import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';

export async function registerCors(app: FastifyInstance, origins: string[]): Promise<void> {
  await app.register(fastifyCors, {
    origin: origins
  });
}
