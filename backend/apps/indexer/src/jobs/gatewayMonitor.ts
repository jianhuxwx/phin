import type Redis from 'ioredis';
import { CacheKeys, TTL, createRedisClient } from 'phin-cache';
import type { GatewayStatus, GatewayHealthStatus } from 'phin-types';
import { publishGatewayStatus } from '../publisher';
import { indexerConfig } from '../config';
import { TimeoutError, withTimeout } from '../utils/retry';

const MONITOR_INTERVAL_MS = 30_000;
const GATEWAY_TIMEOUT_MS = 5_000;
const DEGRADED_LATENCY_THRESHOLD_MS = 2_000;
const FALLBACK_GATEWAY = 'https://arweave.net';

export interface GatewayPingResult {
  url: string;
  alive: boolean;
  latencyMs: number;
  blockHeight: number | null;
  error: string | null;
}

const consecutiveFailureCounts = new Map<string, number>();

let redisClient: Redis | null = null;
let redisPubClient: Redis | null = null;
let monitorInterval: NodeJS.Timeout | null = null;

function normalizeGatewayUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildGatewayList(): string[] {
  const configured = [indexerConfig.gateArUrl, ...indexerConfig.gateArFallbackUrls];
  const urls = [...configured, FALLBACK_GATEWAY];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of urls) {
    const trimmed = raw?.trim();
    if (!trimmed) {
      continue;
    }
    const normalizedUrl = normalizeGatewayUrl(trimmed);
    if (!normalizedUrl) {
      continue;
    }
    if (seen.has(normalizedUrl)) {
      continue;
    }
    seen.add(normalizedUrl);
    normalized.push(normalizedUrl);
  }

  return normalized;
}

export const KNOWN_GATEWAYS = buildGatewayList();

export function trackConsecutiveFailures(url: string, alive: boolean): number {
  if (alive) {
    consecutiveFailureCounts.set(url, 0);
    return 0;
  }

  const next = (consecutiveFailureCounts.get(url) ?? 0) + 1;
  consecutiveFailureCounts.set(url, next);
  return next;
}

export function resetGatewayFailureCounts(): void {
  consecutiveFailureCounts.clear();
}

function determineStatus(alive: boolean, latencyMs: number): GatewayHealthStatus {
  if (!alive) {
    return 'down';
  }
  if (latencyMs > DEGRADED_LATENCY_THRESHOLD_MS) {
    return 'degraded';
  }
  return 'healthy';
}

export async function pingGateway(url: string): Promise<GatewayPingResult> {
  const normalizedUrl = normalizeGatewayUrl(url);
  const controller = new AbortController();
  const startedAt = Date.now();

  try {
    const response = await withTimeout(
      () =>
        fetch(`${normalizedUrl}/info`, {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          },
          signal: controller.signal
        }),
      GATEWAY_TIMEOUT_MS
    ).catch((err) => {
      if (err instanceof TimeoutError) {
        controller.abort();
      }
      throw err;
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let blockHeight: number | null = null;

    try {
      const payload = await response.json();
      if (typeof payload?.height === 'number') {
        blockHeight = payload.height;
      }
    } catch (err) {
      throw new Error(`Failed to parse /info response JSON: ${(err as Error).message}`);
    }

    return {
      url: normalizedUrl,
      alive: true,
      latencyMs,
      blockHeight,
      error: null
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'Unknown error';

    return {
      url: normalizedUrl,
      alive: false,
      latencyMs,
      blockHeight: null,
      error: message
    };
  }
}

export async function pingAllGateways(urls: string[]): Promise<GatewayPingResult[]> {
  const settled = await Promise.allSettled(urls.map((url) => pingGateway(url)));

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const fallbackUrl = normalizeGatewayUrl(urls[index]);
    const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';

    return {
      url: fallbackUrl,
      alive: false,
      latencyMs: GATEWAY_TIMEOUT_MS,
      blockHeight: null,
      error: message
    };
  });
}

export function computeGatewayStatuses(results: GatewayPingResult[]): GatewayStatus[] {
  const timestamp = Date.now();

  return results.map((result) => {
    const failures = trackConsecutiveFailures(result.url, result.alive);
    const status = determineStatus(result.alive, result.latencyMs);

    return {
      url: result.url,
      alive: result.alive,
      latencyMs: result.latencyMs,
      blockHeight: result.blockHeight,
      lastCheckedAt: timestamp,
      consecutiveFailures: failures,
      status,
      error: result.error
    };
  });
}

export async function updateGatewayCache(statuses: GatewayStatus[]): Promise<void> {
  if (!redisClient) {
    console.warn('[GatewayMonitor] Redis client not initialised, skipping cache update');
    return;
  }

  try {
    const payload = JSON.stringify(statuses);

    if (TTL.GATEWAY_STATUS > 0) {
      await redisClient.set(
        CacheKeys.gatewayStatus(),
        payload,
        'EX',
        TTL.GATEWAY_STATUS
      );
    } else {
      await redisClient.set(CacheKeys.gatewayStatus(), payload);
    }
  } catch (err) {
    console.error(
      '[GatewayMonitor] Failed to update gateway cache',
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  }
}

export function getPreferredGatewayUrl(statuses: GatewayStatus[]): string {
  if (!statuses.length) {
    return FALLBACK_GATEWAY;
  }

  const sorted = [...statuses].sort((a, b) => a.latencyMs - b.latencyMs);
  const healthy = sorted.find((status) => status.status === 'healthy');
  if (healthy) {
    return healthy.url;
  }

  const degraded = sorted.find((status) => status.status === 'degraded');
  if (degraded) {
    return degraded.url;
  }

  return statuses.find((status) => status.url === FALLBACK_GATEWAY)?.url ?? FALLBACK_GATEWAY;
}

export async function updateActiveGateway(url: string): Promise<void> {
  if (!redisClient) {
    console.warn('[GatewayMonitor] Redis client not initialised, skipping active gateway update');
    return;
  }

  try {
    await redisClient.set(CacheKeys.gatewayActive(), url);
  } catch (err) {
    console.error(
      `[GatewayMonitor] Failed to persist active gateway (${url})`,
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  }
}

async function runGatewayMonitorTick(): Promise<void> {
  const results = await pingAllGateways(KNOWN_GATEWAYS);
  const statuses = computeGatewayStatuses(results);

  await updateGatewayCache(statuses);
  const preferred = getPreferredGatewayUrl(statuses);
  await updateActiveGateway(preferred);
  await publishGatewayStatus(redisPubClient, statuses);

  console.log('[GatewayMonitor] tick completed', {
    gateways: KNOWN_GATEWAYS.length,
    preferred
  });
}

function ensureRedisClients(): void {
  if (!redisClient) {
    redisClient = createRedisClient(indexerConfig.redisUrl);
  }
  if (!redisPubClient) {
    redisPubClient = createRedisClient(indexerConfig.redisUrl);
  }
}

function cleanup(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  if (redisPubClient) {
    redisPubClient.disconnect();
    redisPubClient = null;
  }
}

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

export function startGatewayMonitor(): NodeJS.Timeout {
  if (monitorInterval) {
    return monitorInterval;
  }

  ensureRedisClients();

  runGatewayMonitorTick().catch((err) => {
    console.error('[GatewayMonitor] Initial tick failed', err);
  });

  monitorInterval = setInterval(() => {
    runGatewayMonitorTick().catch((err) => {
      console.error('[GatewayMonitor] Tick failed', err);
    });
  }, MONITOR_INTERVAL_MS);

  console.log('[GatewayMonitor] Started', {
    intervalMs: MONITOR_INTERVAL_MS,
    gateways: KNOWN_GATEWAYS
  });

  return monitorInterval;
}
