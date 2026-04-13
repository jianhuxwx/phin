import assert from 'node:assert/strict';

import {
  chunkArray,
  sleep,
  TimeoutError,
  withRetry,
  withTimeout,
  type RetryLogMetadata
} from '../src/utils/retry';

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        console.log(`[RetryUtils:test] PASS ${name}`);
      },
      (err) => {
        console.error(`[RetryUtils:test] FAIL ${name}`);
        console.error(err);
        throw err;
      }
    );
}

function silentLogger(_info: RetryLogMetadata): void {
  // Intentionally noop to avoid noisy test output.
}

async function runTests() {
  await test('sleep waits roughly the requested duration', async () => {
    const durationMs = 20;
    const started = Date.now();
    await sleep(durationMs);
    const elapsed = Date.now() - started;
    assert.ok(
      elapsed >= durationMs - 5,
      `Expected elapsed time to be at least ${durationMs - 5}ms but was ${elapsed}`
    );
  });

  await test('chunkArray splits arrays into even chunks', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5], 2);
    assert.deepEqual(chunks, [
      [1, 2],
      [3, 4],
      [5]
    ]);
  });

  await test('chunkArray throws for invalid size', () => {
    assert.throws(() => chunkArray([1, 2, 3], 0), /chunk size/);
  });

  await test('withRetry resolves after transient failures', async () => {
    let attempt = 0;
    const value = await withRetry(
      async () => {
        attempt += 1;
        if (attempt < 3) {
          throw new Error('not yet');
        }
        return 'done';
      },
      {
        maxAttempts: 4,
        delayMs: 0,
        logger: silentLogger
      }
    );

    assert.equal(value, 'done');
    assert.equal(attempt, 3);
  });

  await test('withRetry applies exponential backoff delays when requested', async () => {
    const delays: number[] = [];
    const sleepFn = async (ms: number) => {
      delays.push(ms);
    };

    await assert.rejects(
      withRetry(
        async () => {
          throw new Error('always fails');
        },
        {
          maxAttempts: 3,
          delayMs: 10,
          backoff: true,
          sleepFn,
          logger: silentLogger
        }
      ),
      /always fails/
    );

    assert.deepEqual(delays, [10, 20]);
  });

  await test('withRetry surfaces the last error after exhausting attempts', async () => {
    await assert.rejects(
      withRetry(
        async () => {
          throw new Error('persistent failure');
        },
        {
          maxAttempts: 2,
          delayMs: 0,
          logger: silentLogger
        }
      ),
      /persistent failure/
    );
  });

  await test('withTimeout resolves successfully within the deadline', async () => {
    const result = await withTimeout(
      async () => {
        await sleep(5);
        return 42;
      },
      50
    );

    assert.equal(result, 42);
  });

  await test('withTimeout rejects with TimeoutError when exceeding the deadline', async () => {
    await assert.rejects(
      withTimeout(async () => {
        await sleep(50);
        return 'never';
      }, 10),
      TimeoutError
    );
  });

  console.log('[RetryUtils:test] All retry utility tests completed');
}

runTests().catch((err) => {
  console.error('[RetryUtils:test] Test suite failed', err);
  process.exitCode = 1;
});
