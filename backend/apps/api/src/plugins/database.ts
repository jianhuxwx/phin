import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

import { createDatabasePool } from '../db/client';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

export async function registerDatabase(
  app: FastifyInstance,
  databaseUrl: string,
  existingPool?: Pool
): Promise<void> {
  const pool = existingPool ?? createDatabasePool(databaseUrl);
  app.decorate('db', pool);

  if (!existingPool) {
    app.addHook('onClose', async () => {
      await pool.end();
    });
  }
}
