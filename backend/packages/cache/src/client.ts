import Redis from 'ioredis';

export function createRedisClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      return Math.min(times * 500, 5_000);
    }
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

export async function waitForRedisReady(
  client: Redis,
  timeoutMs = 5_000
): Promise<void> {
  if (client.status === 'ready' || client.status === 'connect') {
    return;
  }

  if (client.status === 'wait') {
    await client.connect();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Redis did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const onClose = () => {
      cleanup();
      reject(new Error('Redis connection closed before becoming ready'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      client.off('ready', onReady);
      client.off('error', onError);
      client.off('close', onClose);
      client.off('end', onClose);
    };

    client.on('ready', onReady);
    client.on('error', onError);
    client.on('close', onClose);
    client.on('end', onClose);
  });
}
