import { Pool } from 'pg';

const POOL_OPTIONS = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
};

export function createDatabasePool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    ...POOL_OPTIONS
  });

  pool.on('error', (error) => {
    console.error('Unexpected Postgres client error', error);
  });

  return pool;
}
