import type { Pool } from 'pg';
import type { ApiArnsRecord, PaginatedResponse } from '../contracts';

function mapRecord(row: any): ApiArnsRecord {
  return {
    name: row.name,
    ownerAddress: row.owner_address,
    transactionId: row.transaction_id,
    registeredAt: new Date(row.registered_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    recordType: row.record_type,
    undernameLimit: row.undername_limit
  };
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

  async getByName(name: string): Promise<ApiArnsRecord | null> {
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
        WHERE name = $1
        LIMIT 1
      `,
      [name]
    );

    return result.rows[0] ? mapRecord(result.rows[0]) : null;
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
