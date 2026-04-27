import { indexerConfig } from './config';
import { createRedisClient, waitForRedisReady } from 'phin-cache';
import { startBlockPoller } from './jobs/blockPoller';
import { startGatewayMonitor } from './jobs/gatewayMonitor';
import { startArnsSync } from './jobs/arnsSync';
import { createDatabasePool, testConnection } from './db/client';

async function start() {
  console.log('Starting indexer with config', {
    nodeEnv: indexerConfig.nodeEnv
  });

  const redis = createRedisClient(indexerConfig.redisUrl);
  const databasePool = createDatabasePool(indexerConfig.databaseUrl);

  // Verify Redis is reachable before starting background jobs so failures are
  // caught early rather than surfacing only through log noise later.
  try {
    await waitForRedisReady(redis);
    await redis.ping();
    console.log('Redis connection verified');
  } catch (error) {
    console.error('Redis connectivity test failed', error);
    redis.disconnect();
    process.exit(1);
  }

  await testConnection(databasePool);
  console.log('Database connection verified');

  const timers: NodeJS.Timeout[] = [];
  timers.push(startBlockPoller());
  timers.push(startGatewayMonitor());
  timers.push(startArnsSync(databasePool));

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log('Shutting down indexer...');
    timers.forEach((t) => clearInterval(t));
    redis.disconnect();
    try {
      await databasePool.end();
      console.log('Database pool closed');
    } catch (error) {
      console.error('Error closing database pool', error);
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Indexer failed to start', err);
  process.exit(1);
});
