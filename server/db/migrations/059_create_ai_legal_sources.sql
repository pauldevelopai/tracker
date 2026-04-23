-- AI Legal: pluggable source ingestion infrastructure.
--
-- Three tables:
--   ai_legal_sources      — one row per source (RSS feed, HTML page, social handle, API endpoint)
--   ai_legal_raw_items    — staging table: everything a scraper pulls lands here first
--   ai_legal_source_runs  — audit log of every dispatcher run, for health monitoring
--
-- The design keeps the scraping surface purely data-driven so new sources can
-- be added without touching code.

CREATE TABLE IF NOT EXISTS ai_legal_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  -- Kinds: 'rss', 'html', 'api_json', 'bluesky', 'mastodon', 'reddit'
  url TEXT NOT NULL,
  jurisdiction VARCHAR(200),
  -- What jurisdiction (or 'International') the source primarily covers.
  tags TEXT[] DEFAULT '{}',
  -- Tags e.g. 'regulator', 'court', 'news', 'social', 'academic', 'tracker'
  active BOOLEAN NOT NULL DEFAULT true,
  run_frequency_hours INTEGER NOT NULL DEFAULT 6,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Kind-specific config:
  --   rss:      {} (just fetch the feed)
  --   html:     { article_selector, title_selector, date_selector, content_selector }
  --   bluesky:  { handle: 'user.bsky.social' }
  --   mastodon: { instance: 'mastodon.social', handle: 'user' }
  --   reddit:   { subreddit: 'law', mode: 'new' | 'hot' }
  --   api_json: { items_path, id_path, title_path, url_path, date_path }
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_promoted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_legal_sources_kind_url_uniq UNIQUE (kind, url)
);

CREATE INDEX IF NOT EXISTS idx_ai_legal_sources_active   ON ai_legal_sources(active);
CREATE INDEX IF NOT EXISTS idx_ai_legal_sources_kind     ON ai_legal_sources(kind);
CREATE INDEX IF NOT EXISTS idx_ai_legal_sources_tags     ON ai_legal_sources USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_ai_legal_sources_last_run ON ai_legal_sources(last_run_at NULLS FIRST) WHERE active = true;
-- Dispatcher picks due sources by ordering on last_run_at ASC NULLS FIRST then
-- filtering in the query by (now() - last_run_at) > run_frequency_hours.


CREATE TABLE IF NOT EXISTS ai_legal_raw_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES ai_legal_sources(id) ON DELETE CASCADE,
  external_id TEXT,
  -- Source-native identifier: RSS <guid>, bluesky post URI, reddit post ID,
  -- mastodon status ID, etc. Used with source_id for dedup.
  url TEXT,
  title TEXT,
  content TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB,
  -- Original item as returned by the source (for debugging / re-triage).
  triage_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- 'pending'    — not yet classified
  -- 'classified' — classifier ran; see triage_result for the call
  -- 'promoted'   — turned into a lawsuit/regulation or an event on one
  -- 'rejected'   — classifier or human said 'not relevant'
  -- 'duplicate'  — matches an existing item from another source
  triage_result JSONB,
  -- {classification, match_type, match_id, confidence, reason, suggested_event_type}
  triaged_at TIMESTAMPTZ,
  lawsuit_id     UUID REFERENCES ai_lawsuits(id)    ON DELETE SET NULL,
  regulation_id  UUID REFERENCES ai_regulations(id) ON DELETE SET NULL,
  event_id       UUID,
  -- If promoted to an ai_lawsuit_events / ai_regulation_events row, its id.
  CONSTRAINT ai_legal_raw_items_dedup UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_legal_raw_items_source       ON ai_legal_raw_items(source_id);
CREATE INDEX IF NOT EXISTS idx_ai_legal_raw_items_status       ON ai_legal_raw_items(triage_status);
CREATE INDEX IF NOT EXISTS idx_ai_legal_raw_items_published    ON ai_legal_raw_items(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_legal_raw_items_fetched      ON ai_legal_raw_items(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_legal_raw_items_lawsuit      ON ai_legal_raw_items(lawsuit_id)    WHERE lawsuit_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_legal_raw_items_regulation   ON ai_legal_raw_items(regulation_id) WHERE regulation_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS ai_legal_source_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES ai_legal_sources(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  items_seen       INTEGER NOT NULL DEFAULT 0,
  items_new        INTEGER NOT NULL DEFAULT 0,
  items_duplicate  INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'running',
  -- 'running', 'success', 'error'
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_legal_source_runs_source ON ai_legal_source_runs(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_legal_source_runs_status ON ai_legal_source_runs(status);
