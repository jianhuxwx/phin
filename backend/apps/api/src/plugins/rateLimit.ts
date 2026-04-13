import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

interface RateLimitOptions {
  max: number;
  timeWindow: number;
}

export async function registerRateLimit(
  app: FastifyInstance,
  options: RateLimitOptions
): Promise<void> {
  await app.register(rateLimit, {
    max: options.max,
    timeWindow: options.timeWindow
  });
}

