-- Public API keys for /api/v1/* consumers.
--
-- We store SHA-256 hashes of keys, not the raw values, so a DB dump can't
-- leak working keys. The raw key is returned exactly once at creation.
--
-- `tier` is advisory for now; daily_limit is the load-bearing field.

CREATE TABLE IF NOT EXISTS ai_legal_api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash        TEXT NOT NULL UNIQUE,           -- sha256 hex of the raw key
  key_prefix      VARCHAR(16) NOT NULL,            -- first 12 chars of the raw key, for display/lookup hinting
  owner_name      VARCHAR(200) NOT NULL,
  owner_email     VARCHAR(320),
  description     TEXT,
  tier            VARCHAR(40) NOT NULL DEFAULT 'free',
  daily_limit     INTEGER NOT NULL DEFAULT 10000,
  requests_today  INTEGER NOT NULL DEFAULT 0,
  window_start    DATE NOT NULL DEFAULT CURRENT_DATE,
  last_used_at    TIMESTAMPTZ,
  last_used_ip    INET,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON ai_legal_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON ai_legal_api_keys(revoked_at) WHERE revoked_at IS NULL;
