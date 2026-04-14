import assert from 'node:assert/strict';

import type { Pool } from 'pg';

import { createDatabasePool } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { loadIndexerEnv } from '../src/loadEnv';

loadIndexerEnv();

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'GATE_AR_URL', 'GATE_AR_FALLBACK_URLS', 'REDIS_URL'];

type ArnsSyncModule = typeof import('../src/jobs/arnsSync');

let runArNSSync: ArnsSyncModule['runArNSSync'];
let ARNS_SYNC_STATE_KEY: ArnsSyncModule['ARNS_SYNC_STATE_KEY'];

process.env.NODE_ENV ??= 'test';

function log(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(`[ArNSSync:test] ${message}`, meta);
  } else {
    console.log(`[ArNSSync:test] ${message}`);
  }
}

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        log(`PASS ${name}`);
      },
      (err) => {
        console.error(`[ArNSSync:test] FAIL ${name}`);
        console.error(err);
        throw err;
      }
    );
}

async function ensureArnsModuleLoaded(): Promise<void> {
  if (runArNSSync && ARNS_SYNC_STATE_KEY) {
    return;
  }

  const module = await import('../src/jobs/arnsSync');
  runArNSSync = module.runArNSSync;
  ARNS_SYNC_STATE_KEY = module.ARNS_SYNC_STATE_KEY;
}

function getMissingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
}

async function getRecordCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM arns_records`);
  return result.rows[0]?.count ?? 0;
}

async function resetTables(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM arns_records');
  await pool.query('DELETE FROM sync_state WHERE key = $1', [ARNS_SYNC_STATE_KEY]);
}

async function runSuite(): Promise<void> {
  const missingEnv = getMissingEnvVars();
  if (missingEnv.length) {
    console.warn(
      `[ArNSSync:test] Skipping ArNS sync tests. Missing environment variables: ${missingEnv.join(', ')}`
    );
    return;
  }

  await ensureArnsModuleLoaded();

  const databaseUrl = process.env.DATABASE_URL!;
  await runMigrations(databaseUrl);

  const pool = createDatabasePool(databaseUrl);

  try {
    await test('runArNSSync performs a full sync and records state', async () => {
      await resetTables(pool);

      await runArNSSync(pool);
      const firstCount = await getRecordCount(pool);
      assert.ok(firstCount > 0, 'Expected at least one ArNS record after full sync');

      const syncStateResult = await pool.query<{ value: string }>(
        'SELECT value FROM sync_state WHERE key = $1',
        [ARNS_SYNC_STATE_KEY]
      );
      assert.equal(syncStateResult.rowCount, 1, 'Sync state row should exist after sync');
      const syncTimestamp = new Date(syncStateResult.rows[0].value);
      assert.ok(!Number.isNaN(syncTimestamp.getTime()), 'Sync timestamp should be a valid date');

      await runArNSSync(pool);
      const secondCount = await getRecordCount(pool);
      assert.ok(
        secondCount >= firstCount,
        'Incremental ArNS sync should be idempotent and not remove records'
      );
    });
  } finally {
    await pool.end();
  }

  log('All ArNS sync tests completed');
}

runSuite().catch((err) => {
  console.error('[ArNSSync:test] Test suite failed', err);
  process.exitCode = 1;
});
