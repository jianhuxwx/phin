import { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';

export async function registerJwt(app: FastifyInstance, secret: string): Promise<void> {
  await app.register(fastifyJwt, {
    secret
  });
}

