import type { Pool } from 'pg';
import type { GraphQLClient } from 'graphql-request';
import { createGatewayClient } from 'phin-gateway';
import type { ArNSRecord } from 'phin-types';

import { indexerConfig } from '../config';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const PAGE_SIZE = 200;
// Upper bound on the number of records we will accumulate in memory during a
// single sync run. Use Infinity by default so we never silently drop records
// due to local limits; paging and the `since` boundary control total work.
const RECORD_LIMIT = Number.POSITIVE_INFINITY;
const BATCH_SIZE = 100;
const SYNC_STATE_KEY = 'arns_sync';
const APP_NAME_TAG_VALUES = ['ArNS-Registry', 'ArNS'] as const;
const ACTION_TAG_VALUES = ['Register', 'Renew', 'Update', 'Set-Record'] as const;
const APP_NAME_TAG_VALUES_LITERAL = APP_NAME_TAG_VALUES.map((value) => `"${value}"`).join(', ');
const ACTION_TAG_VALUES_LITERAL = ACTION_TAG_VALUES.map((value) => `"${value}"`).join(', ');

const ARNS_TRANSACTIONS_QUERY = /* GraphQL */ `
  query ArnsTransactions($cursor: String, $limit: Int!) {
    transactions(
      after: $cursor,
      first: $limit,
      sort: HEIGHT_DESC,
      tags: [
        { name: "App-Name", values: [${APP_NAME_TAG_VALUES_LITERAL}] },
        { name: "Action", values: [${ACTION_TAG_VALUES_LITERAL}] }
      ]
    ) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          owner {
            address
          }
          block {
            timestamp
          }
          tags {
            name
            value
          }
        }
      }
    }
  }
`;

interface GraphQLTag {
  name: string;
  value: string;
}

interface GraphQLTransactionNode {
  id: string;
  owner?: {
    address?: string;
  } | null;
  block?: {
    timestamp?: number | null;
  } | null;
  tags?: GraphQLTag[] | null;
}

interface GraphQLTransactionEdge {
  cursor: string;
  node: GraphQLTransactionNode;
}

interface ArnsTransactionsResponse {
  transactions?: {
    pageInfo: {
      hasNextPage: boolean;
    };
    edges: GraphQLTransactionEdge[];
  };
}

interface FetchPageResult {
  records: ArNSRecord[];
  nextCursor: string | null;
}

let gatewayClient: GraphQLClient | null = null;
let syncInterval: NodeJS.Timeout | null = null;

function buildGraphqlEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/graphql`;
}

function getGatewayClient(): GraphQLClient {
  if (!gatewayClient) {
    gatewayClient = createGatewayClient(buildGraphqlEndpoint(indexerConfig.gateArUrl));
  }
  return gatewayClient;
}

function normaliseTagName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

function buildTagMaps(tags: GraphQLTag[] | null | undefined): {
  raw: Record<string, string>;
  normalised: Map<string, string>;
} {
  const raw: Record<string, string> = {};
  const normalised = new Map<string, string>();

  if (!tags) {
    return { raw, normalised };
  }

  for (const tag of tags) {
    if (!tag?.name) {
      continue;
    }
    const value = tag.value ?? '';
    if (!(tag.name in raw)) {
      raw[tag.name] = value;
    }
    const key = normaliseTagName(tag.name);
    if (!normalised.has(key)) {
      normalised.set(key, value);
    }
  }

  return { raw, normalised };
}

function parseTimestampValue(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    const milliseconds = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    return new Date(milliseconds);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function toInt(value: string | null | undefined, fallback = 0): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function deriveDomainName(normalisedTags: Map<string, string>): string | null {
  const domain =
    normalisedTags.get('domain-name') ??
    normalisedTags.get('domain') ??
    normalisedTags.get('name') ??
    null;

  if (domain) {
    return domain;
  }

  const base = normalisedTags.get('root-domain') ?? normalisedTags.get('parent-domain');
  const sub = normalisedTags.get('sub-domain');
  if (base && sub) {
    if (sub === '@') {
      return base;
    }
    return `${sub}.${base}`;
  }

  return null;
}

function mapNodeToRecord(node: GraphQLTransactionNode): ArNSRecord | null {
  const { raw, normalised } = buildTagMaps(node.tags);
  const name = deriveDomainName(normalised);
  if (!name) {
    return null;
  }

  const ownerAddress =
    node.owner?.address ??
    normalised.get('owner') ??
    normalised.get('wallet') ??
    normalised.get('from') ??
    '';
  if (!ownerAddress) {
    return null;
  }

  const blockTimestamp = node.block?.timestamp ?? null;
  const registeredAt = blockTimestamp ? new Date(blockTimestamp * 1000) : new Date();
  const expiresAt =
    parseTimestampValue(normalised.get('expires')) ??
    parseTimestampValue(normalised.get('expiration')) ??
    null;
  const recordType = normalised.get('action') ?? normalised.get('type') ?? 'unknown';
  const undernameLimit = toInt(normalised.get('undername-limit'));

  return {
    name,
    ownerAddress,
    transactionId: node.id,
    registeredAt,
    expiresAt,
    recordType,
    undernameLimit,
    rawTags: raw
  };
}

function ensureRecordLimit(records: ArNSRecord[]): ArNSRecord[] {
  if (records.length <= RECORD_LIMIT) {
    return records;
  }
  console.warn('[ArNSSync] Reached record cap, truncating', {
    limit: RECORD_LIMIT,
    total: records.length
  });
  return records.slice(0, RECORD_LIMIT);
}

async function executeArnsQuery(options: { cursor?: string | null } = {}): Promise<FetchPageResult> {
  const client = getGatewayClient();
  const response = await client.request<ArnsTransactionsResponse>(ARNS_TRANSACTIONS_QUERY, {
    cursor: options.cursor ?? undefined,
    limit: PAGE_SIZE
  });

  const edges = response.transactions?.edges ?? [];
  const records: ArNSRecord[] = [];

  for (const edge of edges) {
    const record = mapNodeToRecord(edge.node);
    if (record) {
      records.push(record);
    }
  }

  const nextCursor =
    response.transactions?.pageInfo.hasNextPage && edges.length
      ? edges[edges.length - 1]?.cursor ?? null
      : null;

  return {
    records,
    nextCursor
  };
}

export async function fetchArNSRecords(cursor?: string): Promise<FetchPageResult> {
  return executeArnsQuery({ cursor });
}

async function collectRecords(options: { since?: Date } = {}): Promise<ArNSRecord[]> {
  const collected: ArNSRecord[] = [];
  let cursor: string | null = null;

  while (collected.length < RECORD_LIMIT) {
    const { records, nextCursor } = await executeArnsQuery({
      cursor
    });

    let reachedSinceBoundary = false;

    for (const record of records) {
      if (options.since && record.registeredAt <= options.since) {
        reachedSinceBoundary = true;
        continue;
      }

      collected.push(record);
      if (collected.length >= RECORD_LIMIT) {
        break;
      }
    }

    if (!nextCursor) {
      break;
    }

    if (collected.length >= RECORD_LIMIT || reachedSinceBoundary) {
      break;
    }

    cursor = nextCursor;
  }

  return ensureRecordLimit(collected);
}

export async function fetchAllArNSRecords(): Promise<ArNSRecord[]> {
  return collectRecords();
}

export async function fetchRecentArNSRecords(since: Date): Promise<ArNSRecord[]> {
  return collectRecords({ since });
}

const UPSERT_COLUMNS = [
  'name',
  'owner_address',
  'transaction_id',
  'registered_at',
  'expires_at',
  'record_type',
  'undername_limit',
  'raw_tags'
] as const;

function recordToRow(record: ArNSRecord): unknown[] {
  return [
    record.name,
    record.ownerAddress,
    record.transactionId,
    record.registeredAt,
    record.expiresAt,
    record.recordType,
    record.undernameLimit,
    record.rawTags
  ];
}

const UPSERT_CONFLICT_SET = `
  owner_address = EXCLUDED.owner_address,
  transaction_id = EXCLUDED.transaction_id,
  registered_at = EXCLUDED.registered_at,
  expires_at = EXCLUDED.expires_at,
  record_type = EXCLUDED.record_type,
  undername_limit = EXCLUDED.undername_limit,
  raw_tags = EXCLUDED.raw_tags
`;

export async function upsertArNSRecord(record: ArNSRecord, db: Pool): Promise<void> {
  await db.query(
    `
      INSERT INTO arns_records (${UPSERT_COLUMNS.join(', ')})
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (name) DO UPDATE SET
        ${UPSERT_CONFLICT_SET}
    `,
    recordToRow(record)
  );
}

function chunkRecords(records: ArNSRecord[], size: number): ArNSRecord[][] {
  const chunks: ArNSRecord[][] = [];
  for (let i = 0; i < records.length; i += size) {
    chunks.push(records.slice(i, i + size));
  }
  return chunks;
}

export async function upsertArNSRecordsBatch(records: ArNSRecord[], db: Pool): Promise<void> {
  if (!records.length) {
    return;
  }

  const chunks = chunkRecords(records, BATCH_SIZE);

  for (const chunk of chunks) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const values: unknown[] = [];
      const valuePlaceholders = chunk
        .map((record, recordIndex) => {
          const baseIndex = recordIndex * UPSERT_COLUMNS.length;
          recordToRow(record).forEach((value) => values.push(value));
          const placeholders = UPSERT_COLUMNS.map((_, columnIndex) => {
            return `$${baseIndex + columnIndex + 1}`;
          }).join(', ');
          return `(${placeholders})`;
        })
        .join(', ');

      const sql = `
        INSERT INTO arns_records (${UPSERT_COLUMNS.join(', ')})
        VALUES ${valuePlaceholders}
        ON CONFLICT (name) DO UPDATE SET
          ${UPSERT_CONFLICT_SET}
      `;

      await client.query(sql, values);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function getLastSyncTimestamp(db: Pool): Promise<Date | null> {
  const result = await db.query<{ value: string }>(
    `SELECT value FROM sync_state WHERE key = $1 LIMIT 1`,
    [SYNC_STATE_KEY]
  );
  if (!result.rows.length) {
    return null;
  }

  const stored = result.rows[0].value;
  const parsed = new Date(stored);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export async function setLastSyncTimestamp(timestamp: Date, db: Pool): Promise<void> {
  await db.query(
    `
      INSERT INTO sync_state (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `,
    [SYNC_STATE_KEY, timestamp.toISOString()]
  );
}

export async function runArNSSync(db: Pool): Promise<void> {
  const startedAt = Date.now();

  try {
    const lastSync = await getLastSyncTimestamp(db);
    const isIncremental = Boolean(lastSync);

    console.log('[ArNSSync] Starting run', {
      mode: isIncremental ? 'incremental' : 'full',
      lastSync: lastSync?.toISOString() ?? null
    });

    const records = isIncremental ? await fetchRecentArNSRecords(lastSync!) : await fetchAllArNSRecords();

    if (!records.length) {
      await setLastSyncTimestamp(new Date(), db);
      console.log('[ArNSSync] No records to sync');
      return;
    }

    await upsertArNSRecordsBatch(records, db);
    await setLastSyncTimestamp(new Date(), db);

    console.log('[ArNSSync] Sync completed', {
      records: records.length,
      durationMs: Date.now() - startedAt,
      mode: isIncremental ? 'incremental' : 'full'
    });
  } catch (error) {
    console.error(
      '[ArNSSync] Sync run failed',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

export function startArNSSync(db: Pool): NodeJS.Timeout {
  if (!db) {
    throw new Error('startArNSSync requires a database pool instance');
  }

  if (syncInterval) {
    return syncInterval;
  }

  runArNSSync(db).catch((error) => {
    console.error('[ArNSSync] Initial sync failed', error);
  });

  syncInterval = setInterval(() => {
    runArNSSync(db).catch((error) => {
      console.error('[ArNSSync] Scheduled sync failed', error);
    });
  }, SYNC_INTERVAL_MS);

  console.log('[ArNSSync] Scheduler started', {
    intervalMs: SYNC_INTERVAL_MS
  });

  return syncInterval;
}

export const startArnsSync = startArNSSync;
export const ARNS_SYNC_STATE_KEY = SYNC_STATE_KEY;
