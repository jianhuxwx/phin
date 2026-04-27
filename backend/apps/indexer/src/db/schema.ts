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
  ALTER TABLE arns_records
    ADD COLUMN IF NOT EXISTS resolved_url TEXT,
    ADD COLUMN IF NOT EXISTS controller_address TEXT,
    ADD COLUMN IF NOT EXISTS process_id TEXT,
    ADD COLUMN IF NOT EXISTS target_id TEXT,
    ADD COLUMN IF NOT EXISTS target_kind TEXT,
    ADD COLUMN IF NOT EXISTS ttl_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS registered_block_height BIGINT,
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_update_tx_id TEXT,
    ADD COLUMN IF NOT EXISTS purchase_price TEXT,
    ADD COLUMN IF NOT EXISTS purchase_currency TEXT
  `,
  `
  UPDATE arns_records
  SET
    resolved_url = COALESCE(resolved_url, name || '.ar.io'),
    last_updated_at = COALESCE(last_updated_at, registered_at),
    last_update_tx_id = COALESCE(last_update_tx_id, transaction_id)
  `,
  `
  ALTER TABLE arns_records
    ALTER COLUMN resolved_url SET NOT NULL,
    ALTER COLUMN last_updated_at SET NOT NULL,
    ALTER COLUMN last_update_tx_id SET NOT NULL
  `,
  `
  CREATE TABLE IF NOT EXISTS arns_undernames (
    full_name TEXT PRIMARY KEY,
    parent_name TEXT NOT NULL,
    undername TEXT NOT NULL,
    target_id TEXT,
    target_kind TEXT,
    ttl_seconds INTEGER,
    updated_at TIMESTAMPTZ NOT NULL,
    update_tx_id TEXT NOT NULL
  )
  `,
  `
  CREATE INDEX IF NOT EXISTS arns_undernames_parent_name_idx
  ON arns_undernames (parent_name, updated_at DESC)
  `,
  `
  CREATE TABLE IF NOT EXISTS arns_events (
    id BIGSERIAL PRIMARY KEY,
    event_tx_id TEXT NOT NULL,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    owner_address TEXT,
    controller_address TEXT,
    target_id TEXT,
    target_kind TEXT,
    ttl_seconds INTEGER,
    expires_at TIMESTAMPTZ,
    purchase_price TEXT,
    purchase_currency TEXT,
    block_height BIGINT,
    block_timestamp TIMESTAMPTZ NOT NULL,
    raw_tags JSONB NOT NULL,
    UNIQUE (event_tx_id, name, event_type)
  )
  `,
  `
  CREATE INDEX IF NOT EXISTS arns_events_name_timestamp_idx
  ON arns_events (name, block_timestamp DESC, id DESC)
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
