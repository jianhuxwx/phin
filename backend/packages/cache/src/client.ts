import Redis from 'ioredis';

export function createRedisClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: false
  });

  client.on('error', (err) => {
    // Log errors for visibility; consumers can also subscribe if needed.
    console.error('[Redis] connection error:', err);
  });

  client.on('connect', () => {
    console.log('[Redis] connected');
  });

  client.on('close', () => {
    console.warn('[Redis] connection closed');
  });

  return client;
}

