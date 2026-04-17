import { loadApiEnv } from './loadEnv';

loadApiEnv();

interface AppConfig {
  port: number;
  host: string;
  gateArUrl: string;
  gateArFallbackUrls: string[];
  redisUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  nodeEnv: string;
  rateLimitPublicMax: number;
  rateLimitWindowMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config: AppConfig = {
  port: Number(requireEnv('PORT')),
  host: requireEnv('HOST'),
  gateArUrl: requireEnv('GATE_AR_URL'),
  gateArFallbackUrls: requireEnv('GATE_AR_FALLBACK_URLS')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
  redisUrl: requireEnv('REDIS_URL'),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  corsOrigins: requireEnv('CORS_ORIGINS')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
  nodeEnv: requireEnv('NODE_ENV'),
  rateLimitPublicMax: Number(requireEnv('RATE_LIMIT_PUBLIC_MAX')),
  rateLimitWindowMs: Number(requireEnv('RATE_LIMIT_WINDOW_MS'))
};

export { config, AppConfig };
