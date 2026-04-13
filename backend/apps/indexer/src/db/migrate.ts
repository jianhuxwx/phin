import { resolve } from 'node:path';

import { createDatabasePool } from './client';
import { schemaStatements } from './schema';

async function runMigrations(connectionString: string): Promise<void> {
  console.log('Ensuring database schema...');
  const pool = createDatabasePool(connectionString);
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    for (const statement of schemaStatements) {
      await client.query(statement);
    }

    await client.query('COMMIT');
    console.log('Database schema ready');
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    console.error('Database migration failed', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const isDirectExecution = executedPath === __filename;

if (isDirectExecution) {
  import('../config.js')
    .then(({ indexerConfig }) => runMigrations(indexerConfig.databaseUrl))
    .catch((error) => {
      process.exitCode = 1;
      console.error('Migration process exited with errors', error);
    });
}

export { runMigrations };
