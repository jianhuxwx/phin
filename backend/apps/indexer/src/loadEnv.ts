import { resolve } from 'node:path';
import dotenv from 'dotenv';

export const INDEXER_ENV_PATH = resolve(__dirname, '../../../.env');

export function loadIndexerEnv(): void {
  dotenv.config({ path: INDEXER_ENV_PATH });
}
