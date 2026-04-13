const schemaStatements = [
  `
  CREATE TABLE IF NOT EXISTS arns_records (
    name TEXT PRIMARY KEY,
    owner_address TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    record_type TEXT NOT NULL,
    undername_limit INTEGER NOT NULL DEFAULT 0,
    raw_tags JSONB NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS gateway_events (
    id BIGSERIAL PRIMARY KEY,
    gateway_url TEXT NOT NULL,
    is_alive BOOLEAN NOT NULL,
    latency_ms INTEGER,
    block_height BIGINT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `
] as const;

export { schemaStatements };
