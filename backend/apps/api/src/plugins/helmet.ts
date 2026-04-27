import type { FastifyInstance } from 'fastify';
import fastifyHelmet from '@fastify/helmet';

export async function registerHelmet(app: FastifyInstance): Promise<void> {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false
  });
}
