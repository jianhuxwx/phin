import { Pool } from 'pg';

const POOL_OPTIONS = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
};

function createDatabasePool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    ...POOL_OPTIONS
  });

  pool.on('error', (error) => {
    console.error('Unexpected Postgres client error', error);
  });

  return pool;
}

async function testConnection(pool: Pool): Promise<void> {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('Database connectivity test failed', error);
    throw error;
  }
}

export { createDatabasePool, testConnection };
