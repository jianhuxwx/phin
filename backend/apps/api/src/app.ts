import { ensureDiagnosticsChannelCompatibility } from './polyfills/diagnostics';
import type Redis from 'ioredis';
import type { Pool } from 'pg';
import type { FastifyServerOptions } from 'fastify';
import { config } from './config';
import { registerCors } from './plugins/cors';
import { registerHelmet } from './plugins/helmet';
import { registerRateLimit } from './plugins/rateLimit';
import { registerJwt } from './plugins/jwt';
import { registerWebsocket } from './plugins/websocket';
import { registerSwagger } from './plugins/swagger';
import { registerRedis } from './plugins/redis';
import { registerDatabase } from './plugins/database';
import { registerGateway } from './plugins/gateway';
import { registerRoutes } from './routes';
import type { GatewayDataSource } from './clients/gateway';

ensureDiagnosticsChannelCompatibility();

export interface BuildAppOptions {
  fastify?: FastifyServerOptions;
  redis?: Redis;
  db?: Pool;
  gateway?: GatewayDataSource;
  enableWebsocket?: boolean;
  enableSwagger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const [{ default: Fastify }, { default: fastifySensible }] = await Promise.all([
    import('fastify'),
    import('@fastify/sensible')
  ]);

  const app = Fastify({
    logger: true,
    ...options.fastify
  });

  await app.register(fastifySensible);
  await registerHelmet(app);
  await registerCors(app, config.corsOrigins);
  await registerRateLimit(app, {
    max: config.rateLimitPublicMax,
    timeWindow: config.rateLimitWindowMs,
  });
  await registerJwt(app, config.jwtSecret);
  if (options.enableWebsocket ?? true) {
    await registerWebsocket(app);
  }
  if (options.enableSwagger ?? true) {
    await registerSwagger(app);
  }
  await registerRedis(app, config.redisUrl, options.redis);
  await registerDatabase(app, config.databaseUrl, options.db);
  await registerGateway(
    app,
    [config.gateArUrl, ...config.gateArFallbackUrls],
    config.arnsResolverUrl,
    options.gateway
  );

  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  await registerRoutes(app, {
    enableWebsocket: options.enableWebsocket ?? true
  });

  app.setErrorHandler((error, request, reply) => {
    const safeError = error as { statusCode?: number; message?: string };
    const statusCode = safeError.statusCode ?? 500;
    request.log.error({ err: error }, 'Request failed');
    reply.status(statusCode).send({
      error: safeError.message || 'Internal Server Error',
      statusCode,
    });
  });

  return app;
}
