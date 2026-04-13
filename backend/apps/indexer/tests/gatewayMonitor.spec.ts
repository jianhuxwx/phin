import assert from 'node:assert/strict';
import type { GatewayStatus } from 'phin-types';
import type { GatewayPingResult } from '../src/jobs/gatewayMonitor';

process.env.NODE_ENV ??= 'test';
process.env.GATE_AR_URL ??= 'https://gate.ar';
process.env.GATE_AR_FALLBACK_URLS ??= 'https://arweave.net';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.DATABASE_URL ??= 'postgres://localhost:5432/postgres';

type GatewayMonitorModule = typeof import('../src/jobs/gatewayMonitor');

let computeGatewayStatuses: GatewayMonitorModule['computeGatewayStatuses'];
let getPreferredGatewayUrl: GatewayMonitorModule['getPreferredGatewayUrl'];
let resetGatewayFailureCounts: GatewayMonitorModule['resetGatewayFailureCounts'];
let trackConsecutiveFailures: GatewayMonitorModule['trackConsecutiveFailures'];

async function ensureGatewayMonitorLoaded(): Promise<void> {
  if (
    computeGatewayStatuses &&
    getPreferredGatewayUrl &&
    resetGatewayFailureCounts &&
    trackConsecutiveFailures
  ) {
    return;
  }

  const module = await import('../src/jobs/gatewayMonitor');

  computeGatewayStatuses = module.computeGatewayStatuses;
  getPreferredGatewayUrl = module.getPreferredGatewayUrl;
  resetGatewayFailureCounts = module.resetGatewayFailureCounts;
  trackConsecutiveFailures = module.trackConsecutiveFailures;
}

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(
      () => {
        console.log(`[GatewayMonitor:test] PASS ${name}`);
      },
      (err) => {
        console.error(`[GatewayMonitor:test] FAIL ${name}`);
        console.error(err);
        throw err;
      }
    );
}

function createPingResult(
  overrides: Partial<GatewayPingResult> = {}
): GatewayPingResult {
  return {
    url: 'https://example',
    alive: true,
    latencyMs: 100,
    blockHeight: 123,
    error: null,
    ...overrides
  };
}

function createStatus(overrides: Partial<GatewayStatus> = {}): GatewayStatus {
  return {
    url: 'https://gateway',
    alive: true,
    latencyMs: 100,
    blockHeight: 100,
    lastCheckedAt: Date.now(),
    consecutiveFailures: 0,
    status: 'healthy',
    error: null,
    ...overrides
  };
}

async function runTests() {
  await ensureGatewayMonitorLoaded();

  await test('trackConsecutiveFailures increments and resets', () => {
    resetGatewayFailureCounts();

    assert.equal(trackConsecutiveFailures('https://a', false), 1);
    assert.equal(trackConsecutiveFailures('https://a', false), 2);
    assert.equal(trackConsecutiveFailures('https://b', false), 1);
    assert.equal(trackConsecutiveFailures('https://a', true), 0);
    assert.equal(trackConsecutiveFailures('https://b', true), 0);
  });

  await test('computeGatewayStatuses derives status and failure counts', () => {
    resetGatewayFailureCounts();

    const results: GatewayPingResult[] = [
      createPingResult({ url: 'https://fast', latencyMs: 150, alive: true }),
      createPingResult({ url: 'https://slow', latencyMs: 3000, alive: true }),
      createPingResult({ url: 'https://down', latencyMs: 5000, alive: false, error: 'boom' })
    ];

    const statuses = computeGatewayStatuses(results);

    assert.equal(statuses.length, 3);
    assert.equal(statuses[0].status, 'healthy');
    assert.equal(statuses[1].status, 'degraded');
    assert.equal(statuses[2].status, 'down');
    assert.equal(statuses[2].consecutiveFailures, 1);
    assert.ok(statuses[0].lastCheckedAt <= Date.now());

    // Second run should bump failure count while others remain zero.
    const secondStatuses = computeGatewayStatuses(results);
    assert.equal(secondStatuses[2].consecutiveFailures, 2);
    assert.equal(secondStatuses[0].consecutiveFailures, 0);
  });

  await test('getPreferredGatewayUrl selects healthy, then degraded, then fallback', () => {
    const healthyPreferred = getPreferredGatewayUrl([
      createStatus({ url: 'https://healthy-fast', latencyMs: 100, status: 'healthy' }),
      createStatus({ url: 'https://healthy-slow', latencyMs: 300, status: 'healthy' }),
      createStatus({ url: 'https://degraded', latencyMs: 4000, status: 'degraded' })
    ]);
    assert.equal(healthyPreferred, 'https://healthy-fast');

    const degradedPreferred = getPreferredGatewayUrl([
      createStatus({ url: 'https://degraded-fast', latencyMs: 2500, status: 'degraded', alive: true }),
      createStatus({ url: 'https://down', latencyMs: 5000, status: 'down', alive: false })
    ]);
    assert.equal(degradedPreferred, 'https://degraded-fast');

    const fallbackPreferred = getPreferredGatewayUrl([
      createStatus({ url: 'https://down-a', status: 'down', alive: false }),
      createStatus({ url: 'https://down-b', status: 'down', alive: false })
    ]);
    assert.equal(fallbackPreferred, 'https://arweave.net');

    const emptyPreferred = getPreferredGatewayUrl([]);
    assert.equal(emptyPreferred, 'https://arweave.net');
  });

  console.log('[GatewayMonitor:test] All tests completed');
}

runTests().catch((err) => {
  console.error('[GatewayMonitor:test] Test suite failed', err);
  process.exitCode = 1;
});
