import dotenv from 'dotenv';

dotenv.config();

interface IndexerConfig {
  nodeEnv: string;
  gateArUrl: string;
  gateArFallbackUrls: string[];
  redisUrl: string;
  databaseUrl: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const indexerConfig: IndexerConfig = {
  nodeEnv: requireEnv('NODE_ENV'),
  gateArUrl: requireEnv('GATE_AR_URL'),
  gateArFallbackUrls: requireEnv('GATE_AR_FALLBACK_URLS')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
  redisUrl: requireEnv('REDIS_URL'),
  databaseUrl: requireEnv('DATABASE_URL')
};

export { indexerConfig, IndexerConfig };

