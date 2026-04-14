import assert from 'node:assert/strict';

import { createDatabasePool, testConnection } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { schemaStatements } from '../src/db/schema';
import { loadIndexerEnv } from '../src/loadEnv';

loadIndexerEnv();

function log(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[Database:test] ${message}`, meta);
  } else {
    console.log(`[Database:test] ${message}`);
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
        console.error(`[Database:test] FAIL ${name}`);
        console.error(err);
        throw err;
      }
    );
}

function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      '[Database:test] Skipping database suite because DATABASE_URL is not set. Provide a connection string to enable these tests.'
    );
    return null;
  }
  return url;
}

async function runTests(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return;
  }

  await test('createDatabasePool applies expected configuration', async () => {
    const pool = createDatabasePool(databaseUrl);
    try {
      assert.equal(pool.options.max, 10);
      assert.equal(pool.options.idleTimeoutMillis, 30_000);
      assert.equal(pool.options.connectionTimeoutMillis, 5_000);
      assert.equal(pool.options.connectionString, databaseUrl);
    } finally {
      await pool.end();
    }
  });

  await test('testConnection performs a successful SELECT 1', async () => {
    const pool = createDatabasePool(databaseUrl);
    try {
      await testConnection(pool);
    } finally {
      await pool.end();
    }
  });

  await test('runMigrations executes without error and creates required tables', async () => {
    await runMigrations(databaseUrl);

    const pool = createDatabasePool(databaseUrl);
    try {
      const expectedTables = ['arns_records', 'gateway_events', 'sync_state'];
      const tableResult = await pool.query<{
        table_name: string;
      }>(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      `,
        [expectedTables]
      );

      const presentTables = tableResult.rows.map((row) => row.table_name);
      expectedTables.forEach((table) => {
        assert.ok(
          presentTables.includes(table),
          `Expected table ${table} to exist after migration`
        );
      });

      const requiredColumns: Record<string, string[]> = {
        arns_records: [
          'name',
          'owner_address',
          'transaction_id',
          'registered_at',
          'expires_at',
          'record_type',
          'undername_limit',
          'raw_tags'
        ],
        gateway_events: [
          'id',
          'gateway_url',
          'is_alive',
          'latency_ms',
          'block_height',
          'checked_at'
        ],
        sync_state: ['key', 'value', 'updated_at']
      };

      for (const [tableName, columns] of Object.entries(requiredColumns)) {
        const columnResult = await pool.query<{ column_name: string }>(
          `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
          `,
          [tableName]
        );
        const existingColumnNames = columnResult.rows.map((row) => row.column_name);
        columns.forEach((column) => {
          assert.ok(
            existingColumnNames.includes(column),
            `Expected column ${tableName}.${column} to exist`
          );
        });
      }
    } finally {
      await pool.end();
    }
  });

  await test('schemaStatements include required CREATE TABLE clauses', () => {
    const requiredTables: Record<string, string[]> = {
      arns_records: ['name TEXT PRIMARY KEY', 'owner_address TEXT', 'raw_tags JSONB'],
      gateway_events: ['id BIGSERIAL PRIMARY KEY', 'gateway_url TEXT', 'is_alive BOOLEAN'],
      sync_state: ['key TEXT PRIMARY KEY', 'value TEXT', 'updated_at TIMESTAMPTZ']
    };

    for (const [tableName, snippets] of Object.entries(requiredTables)) {
      const statement = schemaStatements.find((stmt) =>
        stmt.toLowerCase().includes(`create table if not exists ${tableName}`)
      );
      assert.ok(statement, `Missing CREATE TABLE for ${tableName}`);
      for (const snippet of snippets) {
        assert.ok(
          statement.includes(snippet),
          `CREATE TABLE for ${tableName} should include snippet: ${snippet}`
        );
      }
    }
  });

  log('All database tests completed');
}

runTests().catch((err) => {
  console.error('[Database:test] Test suite failed', err);
  process.exitCode = 1;
});
