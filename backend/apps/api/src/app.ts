import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import fastifySensible from '@fastify/sensible';
import { config } from './config';
import { registerCors } from './plugins/cors';
import { registerHelmet } from './plugins/helmet';
import { registerRateLimit } from './plugins/rateLimit';
import { registerJwt } from './plugins/jwt';
import { registerWebsocket } from './plugins/websocket';
import { registerSwagger } from './plugins/swagger';
import { registerRedis } from './plugins/redis';
import { registerRoutes } from './routes';

export async function buildApp(
  options: FastifyServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    ...options,
  });

  app.register(fastifySensible);

  await registerHelmet(app);
  await registerCors(app, config.corsOrigins);
  await registerRateLimit(app, {
    max: config.rateLimitPublicMax,
    timeWindow: config.rateLimitWindowMs,
  });
  await registerJwt(app, config.jwtSecret);
  await registerWebsocket(app);
  await registerSwagger(app);
  await registerRedis(app, config.redisUrl);

  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  await registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
    });
  });

  return app;
}

