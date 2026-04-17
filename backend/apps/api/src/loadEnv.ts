import { resolve } from 'node:path';
import dotenv from 'dotenv';

export const API_ENV_PATH = resolve(__dirname, '../../../.env');

export function loadApiEnv(): void {
  dotenv.config({ path: API_ENV_PATH });
}
