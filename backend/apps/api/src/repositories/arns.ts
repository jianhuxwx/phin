import type { Pool } from 'pg';
import type {
  ApiArnsDetail,
  ApiArnsHistoryEvent,
  ApiArnsRecord,
  ApiArnsUndername,
  PaginatedResponse
} from '../contracts';

function toIso(value: string | Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function mapRecord(row: any): ApiArnsRecord {
  return {
    name: row.name,
    ownerAddress: row.owner_address,
    transactionId: row.transaction_id,
    registeredAt: new Date(row.registered_at).toISOString(),
    expiresAt: toIso(row.expires_at),
    recordType: row.record_type,
    undernameLimit: row.undername_limit
  };
}

function mapUndername(row: any): ApiArnsUndername {
  return {
    undername: row.undername,
    fullName: row.full_name,
    targetId: row.target_id,
    targetKind: row.target_kind,
    ttlSeconds: row.ttl_seconds,
    updatedAt: new Date(row.updated_at).toISOString(),
    updateTxId: row.update_tx_id
  };
}

function mapHistoryEvent(row: any): ApiArnsHistoryEvent {
  return {
    eventTxId: row.event_tx_id,
    eventType: row.event_type,
    ownerAddress: row.owner_address,
    controllerAddress: row.controller_address,
    targetId: row.target_id,
    targetKind: row.target_kind,
    ttlSeconds: row.ttl_seconds,
    expiresAt: toIso(row.expires_at),
    purchasePrice: row.purchase_price,
    purchaseCurrency: row.purchase_currency,
    blockHeight: row.block_height,
    blockTimestamp: new Date(row.block_timestamp).toISOString()
  };
}

function computeDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) {
    return null;
  }

  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

function isMissingSchemaError(error: unknown): boolean {
  const pgError = error as { code?: string } | null;
  return pgError?.code === '42703' || pgError?.code === '42P01';
}

export class ArnsRepository {
  constructor(private readonly db: Pool) {}

  async list(options: {
    page: number;
    limit: number;
    ownerAddress?: string;
    query?: string;
  }): Promise<PaginatedResponse<ApiArnsRecord>> {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (options.ownerAddress) {
      values.push(options.ownerAddress);
      conditions.push(`owner_address = $${values.length}`);
    }

    if (options.query) {
      values.push(`${options.query}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (options.page - 1) * options.limit;
    values.push(options.limit + 1);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    const result = await this.db.query(
      `
        SELECT
          name,
          owner_address,
          transaction_id,
          registered_at,
          expires_at,
          record_type,
          undername_limit
        FROM arns_records
        ${whereClause}
        ORDER BY registered_at DESC, name ASC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      values
    );

    const rows = result.rows.slice(0, options.limit).map(mapRecord);

    return {
      data: rows,
      pagination: {
        page: options.page,
        limit: options.limit,
        hasNextPage: result.rows.length > options.limit
      }
    };
  }

  async getByName(name: string): Promise<ApiArnsDetail | null> {
    let recordResult;
    let undernamesResult;

    try {
      [recordResult, undernamesResult] = await Promise.all([
        this.db.query(
          `
            SELECT
              name,
              owner_address,
              transaction_id,
              registered_at,
              expires_at,
              record_type,
              undername_limit,
              resolved_url,
              controller_address,
              process_id,
              target_id,
              target_kind,
              ttl_seconds,
              registered_block_height,
              last_updated_at,
              last_update_tx_id,
              purchase_price,
              purchase_currency,
              (
                SELECT COUNT(*)::int
                FROM arns_undernames
                WHERE parent_name = arns_records.name
              ) AS undername_count
            FROM arns_records
            WHERE name = $1
            LIMIT 1
          `,
          [name]
        ),
        this.db.query(
          `
            SELECT
              undername,
              full_name,
              target_id,
              target_kind,
              ttl_seconds,
              updated_at,
              update_tx_id
            FROM arns_undernames
            WHERE parent_name = $1
            ORDER BY undername ASC
          `,
          [name]
        )
      ]);
    } catch (error) {
      if (!isMissingSchemaError(error)) {
        throw error;
      }

      const legacyResult = await this.db.query(
        `
          SELECT
            name,
            owner_address,
            transaction_id,
            registered_at,
            expires_at,
            record_type,
            undername_limit
          FROM arns_records
          WHERE name = $1
          LIMIT 1
        `,
        [name]
      );

      const row = legacyResult.rows[0];
      if (!row) {
        return null;
      }

      const base = mapRecord(row);

      return {
        ...base,
        resolvedUrl: `${base.name}.ar.io`,
        controllerAddress: null,
        processId: null,
        targetId: base.transactionId,
        targetKind: 'transaction',
        ttlSeconds: null,
        registeredBlockHeight: null,
        lastUpdatedAt: base.registeredAt,
        lastUpdateTxId: base.transactionId,
        purchasePrice: null,
        purchaseCurrency: null,
        undernameCount: 0,
        undernameLimitHit: false,
        daysRemaining: computeDaysRemaining(base.expiresAt),
        undernames: []
      };
    }

    const row = recordResult.rows[0];
    if (!row) {
      return null;
    }

    const base = mapRecord(row);
    const undernameCount = row.undername_count ?? 0;

    return {
      ...base,
      resolvedUrl: row.resolved_url,
      controllerAddress: row.controller_address,
      processId: row.process_id,
      targetId: row.target_id,
      targetKind: row.target_kind,
      ttlSeconds: row.ttl_seconds,
      registeredBlockHeight: row.registered_block_height,
      lastUpdatedAt: new Date(row.last_updated_at).toISOString(),
      lastUpdateTxId: row.last_update_tx_id,
      purchasePrice: row.purchase_price,
      purchaseCurrency: row.purchase_currency,
      undernameCount,
      undernameLimitHit: row.undername_limit > 0 && undernameCount >= row.undername_limit,
      daysRemaining: computeDaysRemaining(base.expiresAt),
      undernames: undernamesResult.rows.map(mapUndername)
    };
  }

  async getHistory(
    name: string,
    options: { page: number; limit: number }
  ): Promise<PaginatedResponse<ApiArnsHistoryEvent>> {
    const offset = (options.page - 1) * options.limit;
    let result;
    try {
      result = await this.db.query(
        `
          SELECT
            event_tx_id,
            event_type,
            owner_address,
            controller_address,
            target_id,
            target_kind,
            ttl_seconds,
            expires_at,
            purchase_price,
            purchase_currency,
            block_height,
            block_timestamp
          FROM arns_events
          WHERE name = $1
          ORDER BY block_timestamp DESC, id DESC
          LIMIT $2
          OFFSET $3
        `,
        [name, options.limit + 1, offset]
      );
    } catch (error) {
      if (!isMissingSchemaError(error)) {
        throw error;
      }

      return {
        data: [],
        pagination: {
          page: options.page,
          limit: options.limit,
          hasNextPage: false
        }
      };
    }

    return {
      data: result.rows.slice(0, options.limit).map(mapHistoryEvent),
      pagination: {
        page: options.page,
        limit: options.limit,
        hasNextPage: result.rows.length > options.limit
      }
    };
  }

  async countByOwner(ownerAddress: string): Promise<number> {
    const result = await this.db.query(
      `
        SELECT COUNT(*)::int AS count
        FROM arns_records
        WHERE owner_address = $1
      `,
      [ownerAddress]
    );

    return result.rows[0]?.count ?? 0;
  }

  async listByOwner(ownerAddress: string): Promise<ApiArnsRecord[]> {
    const result = await this.db.query(
      `
        SELECT
          name,
          owner_address,
          transaction_id,
          registered_at,
          expires_at,
          record_type,
          undername_limit
        FROM arns_records
        WHERE owner_address = $1
        ORDER BY registered_at DESC, name ASC
      `,
      [ownerAddress]
    );

    return result.rows.map(mapRecord);
  }
}
