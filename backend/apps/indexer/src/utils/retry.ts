export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: boolean;
  logger?: (info: RetryLogMetadata) => void;
  /**
   * Primarily intended for tests so they can stub sleep behaviour.
   */
  sleepFn?: (ms: number) => Promise<void>;
}

export interface RetryLogMetadata {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('chunk size must be a positive integer');
  }

  if (array.length === 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  if (maxAttempts <= 0) {
    throw new Error('maxAttempts must be greater than 0');
  }

  const baseDelayMs = options.delayMs ?? 1000;
  const backoff = options.backoff ?? false;
  const sleepFn = options.sleepFn ?? sleep;
  let currentDelay = baseDelayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const logInfo: RetryLogMetadata = {
        attempt,
        maxAttempts,
        delayMs: Math.max(0, currentDelay),
        error: err
      };

      if (options.logger) {
        options.logger(logInfo);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[Retry] attempt ${attempt}/${maxAttempts} failed: ${message}`,
          err instanceof Error ? err : new Error(String(err))
        );
      }

      if (attempt === maxAttempts) {
        break;
      }

      if (currentDelay > 0) {
        await sleepFn(currentDelay);
      }

      if (backoff) {
        currentDelay *= 2;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('[Retry] failed with an unknown error');
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive integer');
  }

  let timeoutId: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
