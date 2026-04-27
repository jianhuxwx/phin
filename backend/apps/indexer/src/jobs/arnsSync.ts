import type { Pool } from 'pg';
import type { GraphQLClient } from 'graphql-request';
import { createGatewayClient } from 'phin-gateway';
import type { ArNSEvent, ArNSRecord, ArNSUndername } from 'phin-types';

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
const ACTION_TAG_VALUES = ['Register', 'Renew', 'Update', 'Set-Record', 'Transfer', 'Purchase'] as const;
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
            height
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
    height?: number | null;
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
  undernames: ArNSUndername[];
  events: ArNSEvent[];
  nextCursor: string | null;
}

interface CollectedArtifacts {
  records: ArNSRecord[];
  undernames: ArNSUndername[];
  events: ArNSEvent[];
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

function firstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value != null) {
      return value;
    }
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

function toOptionalInt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normaliseRecordType(value: string | null | undefined, expiresAt: Date | null): string {
  const action = (value ?? '').trim().toLowerCase();
  if (action === 'renew') {
    return 'lease';
  }
  if (action === 'register' || action === 'purchase') {
    return expiresAt ? 'lease' : 'permanent';
  }
  return expiresAt ? 'lease' : 'permanent';
}

function deriveResolvedUrl(name: string): string {
  return `${name}.ar.io`;
}

function deriveTargetKind(normalisedTags: Map<string, string>): 'transaction' | 'process' | null {
  if (
    normalisedTags.has('process-id') ||
    normalisedTags.has('process_id') ||
    normalisedTags.has('ao-process-id')
  ) {
    return 'process';
  }

  if (
    normalisedTags.has('transaction-id') ||
    normalisedTags.has('transaction_id') ||
    normalisedTags.has('tx-id') ||
    normalisedTags.has('tx_id') ||
    normalisedTags.has('target-tx-id') ||
    normalisedTags.has('target-id') ||
    normalisedTags.has('target')
  ) {
    return 'transaction';
  }

  return null;
}

function deriveTargetId(normalisedTags: Map<string, string>, targetKind: 'transaction' | 'process' | null): string | null {
  if (targetKind === 'process') {
    return firstDefined(
      normalisedTags.get('process-id'),
      normalisedTags.get('process_id'),
      normalisedTags.get('ao-process-id')
    );
  }

  if (targetKind === 'transaction') {
    return firstDefined(
      normalisedTags.get('transaction-id'),
      normalisedTags.get('transaction_id'),
      normalisedTags.get('tx-id'),
      normalisedTags.get('tx_id'),
      normalisedTags.get('target-tx-id'),
      normalisedTags.get('target-id'),
      normalisedTags.get('target')
    );
  }

  return null;
}

function deriveControllerAddress(normalisedTags: Map<string, string>): string | null {
  return firstDefined(
    normalisedTags.get('controller'),
    normalisedTags.get('controller-address'),
    normalisedTags.get('controller_address')
  );
}

function derivePrice(normalisedTags: Map<string, string>): { value: string | null; currency: string | null } {
  return {
    value: firstDefined(
      normalisedTags.get('purchase-price'),
      normalisedTags.get('purchase_price'),
      normalisedTags.get('price'),
      normalisedTags.get('amount')
    ),
    currency: firstDefined(
      normalisedTags.get('purchase-currency'),
      normalisedTags.get('purchase_currency'),
      normalisedTags.get('currency'),
      normalisedTags.get('token')
    )
  };
}

function deriveUndername(normalisedTags: Map<string, string>): string | null {
  const value = firstDefined(
    normalisedTags.get('undername'),
    normalisedTags.get('sub-domain'),
    normalisedTags.get('subdomain')
  );

  if (!value || value === '@') {
    return null;
  }

  return value;
}

function deriveParentName(normalisedTags: Map<string, string>, fullName: string): string {
  return (
    normalisedTags.get('root-domain') ??
    normalisedTags.get('parent-domain') ??
    normalisedTags.get('domain-name') ??
    normalisedTags.get('domain') ??
    (fullName.includes('.') ? fullName.slice(fullName.lastIndexOf('.') + 1) : fullName)
  );
}

function normaliseEventType(
  action: string | null | undefined,
  undername: string | null,
  ownerAddress: string,
  controllerAddress: string | null,
  targetId: string | null
): ArNSEvent['eventType'] {
  const value = (action ?? '').trim().toLowerCase();

  if (undername) {
    return 'undername_set';
  }
  if (value === 'register') {
    return 'register';
  }
  if (value === 'purchase') {
    return 'purchase';
  }
  if (value === 'renew') {
    return 'renewal';
  }
  if (value === 'transfer') {
    return 'transfer';
  }
  if (value === 'set-record') {
    return 'target_update';
  }
  if ((value === 'update' || value === 'set-controller') && controllerAddress && !targetId) {
    return 'controller_update';
  }
  if (targetId) {
    return 'target_update';
  }
  if (controllerAddress && ownerAddress !== controllerAddress) {
    return 'controller_update';
  }
  return 'update';
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

function mapNodeToArtifacts(node: GraphQLTransactionNode): {
  record: ArNSRecord | null;
  undername: ArNSUndername | null;
  event: ArNSEvent | null;
} {
  const { raw, normalised } = buildTagMaps(node.tags);
  const name = deriveDomainName(normalised);
  if (!name) {
    return { record: null, undername: null, event: null };
  }

  const ownerAddress =
    node.owner?.address ??
    normalised.get('owner') ??
    normalised.get('wallet') ??
    normalised.get('from') ??
    '';
  if (!ownerAddress) {
    return { record: null, undername: null, event: null };
  }

  const blockTimestamp = node.block?.timestamp ?? null;
  const timestamp = blockTimestamp ? new Date(blockTimestamp * 1000) : new Date();
  const expiresAt =
    parseTimestampValue(normalised.get('expires')) ??
    parseTimestampValue(normalised.get('expiration')) ??
    null;
  const targetKind = deriveTargetKind(normalised);
  const targetId = deriveTargetId(normalised, targetKind);
  const controllerAddress = deriveControllerAddress(normalised);
  const price = derivePrice(normalised);
  const recordType = normaliseRecordType(normalised.get('action') ?? normalised.get('type'), expiresAt);
  const undernameLimit = toInt(normalised.get('undername-limit'));
  const ttlSeconds = toOptionalInt(
    firstDefined(normalised.get('ttl-seconds'), normalised.get('ttl'), normalised.get('ttl_seconds'))
  );
  const processId = firstDefined(
    normalised.get('process-id'),
    normalised.get('process_id'),
    normalised.get('ao-process-id')
  );
  const blockHeight = node.block?.height ?? null;
  const undername = deriveUndername(normalised);
  const parentName = deriveParentName(normalised, name);

  const record: ArNSRecord = {
    name,
    ownerAddress,
    transactionId: node.id,
    registeredAt: timestamp,
    expiresAt,
    recordType,
    undernameLimit,
    resolvedUrl: deriveResolvedUrl(name),
    controllerAddress,
    processId,
    targetId,
    targetKind,
    ttlSeconds,
    registeredBlockHeight: blockHeight,
    lastUpdatedAt: timestamp,
    lastUpdateTxId: node.id,
    purchasePrice: price.value,
    purchaseCurrency: price.currency,
    rawTags: raw
  };

  const undernameRecord =
    undername && parentName
      ? {
          parentName,
          undername,
          fullName: name,
          targetId,
          targetKind,
          ttlSeconds,
          updatedAt: timestamp,
          updateTxId: node.id
        }
      : null;

  const event: ArNSEvent = {
    eventTxId: node.id,
    name,
    eventType: normaliseEventType(
      normalised.get('action') ?? normalised.get('type'),
      undername,
      ownerAddress,
      controllerAddress,
      targetId
    ),
    ownerAddress,
    controllerAddress,
    targetId,
    targetKind,
    ttlSeconds,
    expiresAt,
    purchasePrice: price.value,
    purchaseCurrency: price.currency,
    blockHeight,
    blockTimestamp: timestamp,
    rawTags: raw
  };

  return {
    record,
    undername: undernameRecord,
    event
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
  const undernames: ArNSUndername[] = [];
  const events: ArNSEvent[] = [];

  for (const edge of edges) {
    const artifacts = mapNodeToArtifacts(edge.node);
    if (artifacts.record) {
      records.push(artifacts.record);
    }
    if (artifacts.undername) {
      undernames.push(artifacts.undername);
    }
    if (artifacts.event) {
      events.push(artifacts.event);
    }
  }

  const nextCursor =
    response.transactions?.pageInfo.hasNextPage && edges.length
      ? edges[edges.length - 1]?.cursor ?? null
      : null;

  return {
    records,
    undernames,
    events,
    nextCursor
  };
}

export async function fetchArNSRecords(cursor?: string): Promise<FetchPageResult> {
  return executeArnsQuery({ cursor });
}

async function collectArtifacts(options: { since?: Date } = {}): Promise<CollectedArtifacts> {
  const collected: ArNSRecord[] = [];
  const undernames = new Map<string, ArNSUndername>();
  const events = new Map<string, ArNSEvent>();
  let cursor: string | null = null;

  while (collected.length < RECORD_LIMIT) {
    const page = await executeArnsQuery({
      cursor
    });
    const { records, nextCursor } = page;

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

    for (const undername of page.undernames) {
      if (options.since && undername.updatedAt <= options.since) {
        continue;
      }
      undernames.set(undername.fullName, undername);
    }

    for (const event of page.events) {
      if (options.since && event.blockTimestamp <= options.since) {
        continue;
      }
      events.set(`${event.eventTxId}:${event.name}:${event.eventType}`, event);
    }

    if (!nextCursor) {
      break;
    }

    if (collected.length >= RECORD_LIMIT || reachedSinceBoundary) {
      break;
    }

    cursor = nextCursor;
  }

  return {
    records: ensureRecordLimit(collected),
    undernames: Array.from(undernames.values()),
    events: Array.from(events.values())
  };
}

export async function fetchAllArNSRecords(): Promise<ArNSRecord[]> {
  const artifacts = await collectArtifacts();
  return artifacts.records;
}

export async function fetchRecentArNSRecords(since: Date): Promise<ArNSRecord[]> {
  const artifacts = await collectArtifacts({ since });
  return artifacts.records;
}

const UPSERT_COLUMNS = [
  'name',
  'owner_address',
  'transaction_id',
  'registered_at',
  'expires_at',
  'record_type',
  'undername_limit',
  'resolved_url',
  'controller_address',
  'process_id',
  'target_id',
  'target_kind',
  'ttl_seconds',
  'registered_block_height',
  'last_updated_at',
  'last_update_tx_id',
  'purchase_price',
  'purchase_currency',
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
    record.resolvedUrl,
    record.controllerAddress,
    record.processId,
    record.targetId,
    record.targetKind,
    record.ttlSeconds,
    record.registeredBlockHeight,
    record.lastUpdatedAt,
    record.lastUpdateTxId,
    record.purchasePrice,
    record.purchaseCurrency,
    record.rawTags
  ];
}

const UPSERT_CONFLICT_SET = `
  owner_address = EXCLUDED.owner_address,
  transaction_id = EXCLUDED.transaction_id,
  registered_at = LEAST(arns_records.registered_at, EXCLUDED.registered_at),
  expires_at = EXCLUDED.expires_at,
  record_type = EXCLUDED.record_type,
  undername_limit = EXCLUDED.undername_limit,
  resolved_url = EXCLUDED.resolved_url,
  controller_address = EXCLUDED.controller_address,
  process_id = EXCLUDED.process_id,
  target_id = EXCLUDED.target_id,
  target_kind = EXCLUDED.target_kind,
  ttl_seconds = EXCLUDED.ttl_seconds,
  registered_block_height = COALESCE(
    LEAST(arns_records.registered_block_height, EXCLUDED.registered_block_height),
    arns_records.registered_block_height,
    EXCLUDED.registered_block_height
  ),
  last_updated_at = EXCLUDED.last_updated_at,
  last_update_tx_id = EXCLUDED.last_update_tx_id,
  purchase_price = EXCLUDED.purchase_price,
  purchase_currency = EXCLUDED.purchase_currency,
  raw_tags = EXCLUDED.raw_tags
`;

const UNDERNAME_COLUMNS = [
  'full_name',
  'parent_name',
  'undername',
  'target_id',
  'target_kind',
  'ttl_seconds',
  'updated_at',
  'update_tx_id'
] as const;

function undernameToRow(undername: ArNSUndername): unknown[] {
  return [
    undername.fullName,
    undername.parentName,
    undername.undername,
    undername.targetId,
    undername.targetKind,
    undername.ttlSeconds,
    undername.updatedAt,
    undername.updateTxId
  ];
}

const UNDERNAME_CONFLICT_SET = `
  parent_name = EXCLUDED.parent_name,
  undername = EXCLUDED.undername,
  target_id = EXCLUDED.target_id,
  target_kind = EXCLUDED.target_kind,
  ttl_seconds = EXCLUDED.ttl_seconds,
  updated_at = EXCLUDED.updated_at,
  update_tx_id = EXCLUDED.update_tx_id
`;

const EVENT_COLUMNS = [
  'event_tx_id',
  'name',
  'event_type',
  'owner_address',
  'controller_address',
  'target_id',
  'target_kind',
  'ttl_seconds',
  'expires_at',
  'purchase_price',
  'purchase_currency',
  'block_height',
  'block_timestamp',
  'raw_tags'
] as const;

function eventToRow(event: ArNSEvent): unknown[] {
  return [
    event.eventTxId,
    event.name,
    event.eventType,
    event.ownerAddress,
    event.controllerAddress,
    event.targetId,
    event.targetKind,
    event.ttlSeconds,
    event.expiresAt,
    event.purchasePrice,
    event.purchaseCurrency,
    event.blockHeight,
    event.blockTimestamp,
    event.rawTags
  ];
}

export async function upsertArNSRecord(record: ArNSRecord, db: Pool): Promise<void> {
  await db.query(
    `
      INSERT INTO arns_records (${UPSERT_COLUMNS.join(', ')})
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (name) DO UPDATE SET
        ${UPSERT_CONFLICT_SET}
    `,
    recordToRow(record)
  );
}

function chunkRecords<T>(records: T[], size: number): T[][] {
  const chunks: T[][] = [];
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

export async function upsertArNSUndernamesBatch(undernames: ArNSUndername[], db: Pool): Promise<void> {
  if (!undernames.length) {
    return;
  }

  const chunks = chunkRecords(undernames, BATCH_SIZE);

  for (const chunk of chunks) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const values: unknown[] = [];
      const valuePlaceholders = chunk
        .map((undername, recordIndex) => {
          const baseIndex = recordIndex * UNDERNAME_COLUMNS.length;
          undernameToRow(undername).forEach((value) => values.push(value));
          const placeholders = UNDERNAME_COLUMNS.map((_, columnIndex) => `$${baseIndex + columnIndex + 1}`).join(', ');
          return `(${placeholders})`;
        })
        .join(', ');

      await client.query(
        `
          INSERT INTO arns_undernames (${UNDERNAME_COLUMNS.join(', ')})
          VALUES ${valuePlaceholders}
          ON CONFLICT (full_name) DO UPDATE SET
            ${UNDERNAME_CONFLICT_SET}
        `,
        values
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function insertArNSEventsBatch(events: ArNSEvent[], db: Pool): Promise<void> {
  if (!events.length) {
    return;
  }

  const chunks = chunkRecords(events, BATCH_SIZE);

  for (const chunk of chunks) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const values: unknown[] = [];
      const valuePlaceholders = chunk
        .map((event, recordIndex) => {
          const baseIndex = recordIndex * EVENT_COLUMNS.length;
          eventToRow(event).forEach((value) => values.push(value));
          const placeholders = EVENT_COLUMNS.map((_, columnIndex) => `$${baseIndex + columnIndex + 1}`).join(', ');
          return `(${placeholders})`;
        })
        .join(', ');

      await client.query(
        `
          INSERT INTO arns_events (${EVENT_COLUMNS.join(', ')})
          VALUES ${valuePlaceholders}
          ON CONFLICT (event_tx_id, name, event_type) DO NOTHING
        `,
        values
      );

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

    const artifacts = isIncremental
      ? await collectArtifacts({ since: lastSync! })
      : await collectArtifacts();
    const { records, undernames, events } = artifacts;

    if (!records.length) {
      await setLastSyncTimestamp(new Date(), db);
      console.log('[ArNSSync] No records to sync');
      return;
    }

    await upsertArNSRecordsBatch(records, db);
    await upsertArNSUndernamesBatch(undernames, db);
    await insertArNSEventsBatch(events, db);
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
