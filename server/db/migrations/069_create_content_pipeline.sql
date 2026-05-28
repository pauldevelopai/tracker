-- Generic content ingestion pipeline — a domain-parameterised twin of the legal
-- pipeline (059), reused by ALL new scraper domains (monetisation, tools, …).
-- The live legal pipeline (ai_legal_*) is left untouched; new domains use these
-- shared tables, tagged by `domain`.
--
--   content_sources      — one row per source (RSS/HTML/…), tagged by domain
--   content_raw_items    — staging: everything a scraper pulls lands here first
--   content_source_runs  — audit log of every dispatcher run (health)
--   monetisation_items   — the compiled Monetisation dataset (first domain)
--
-- Flow the admin overview tracks per item:
--   coming in   = content_raw_items (triage_status pending/classified)
--   to users    = compiled item status = 'published'
--   to RAG       = compiled item rag_synced = true

CREATE TABLE IF NOT EXISTS content_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(30) NOT NULL,          -- 'monetisation' | 'tools' | …
  name VARCHAR(300) NOT NULL,
  kind VARCHAR(30) NOT NULL,            -- 'rss' | 'html' | 'bluesky' | 'mastodon' | 'puppeteer'
  url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  run_frequency_hours INTEGER NOT NULL DEFAULT 24,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_promoted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_sources_domain_kind_url_uniq UNIQUE (domain, kind, url)
);
CREATE INDEX IF NOT EXISTS idx_content_sources_domain   ON content_sources(domain);
CREATE INDEX IF NOT EXISTS idx_content_sources_active    ON content_sources(active);
CREATE INDEX IF NOT EXISTS idx_content_sources_last_run  ON content_sources(last_run_at NULLS FIRST) WHERE active = true;

CREATE TABLE IF NOT EXISTS content_raw_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  domain VARCHAR(30) NOT NULL,
  external_id TEXT,
  url TEXT,
  title TEXT,
  content TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB,
  triage_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- 'pending' | 'classified' | 'promoted' | 'rejected' | 'duplicate'
  triage_result JSONB,
  triaged_at TIMESTAMPTZ,
  promoted_id UUID,    -- id of the compiled row it became (monetisation_items.id, …)
  CONSTRAINT content_raw_items_dedup UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_content_raw_items_domain     ON content_raw_items(domain);
CREATE INDEX IF NOT EXISTS idx_content_raw_items_source     ON content_raw_items(source_id);
CREATE INDEX IF NOT EXISTS idx_content_raw_items_status     ON content_raw_items(triage_status);
CREATE INDEX IF NOT EXISTS idx_content_raw_items_fetched    ON content_raw_items(fetched_at DESC);

CREATE TABLE IF NOT EXISTS content_source_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  domain VARCHAR(30) NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  items_seen      INTEGER NOT NULL DEFAULT 0,
  items_new       INTEGER NOT NULL DEFAULT 0,
  items_duplicate INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'running',   -- 'running' | 'success' | 'error'
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_source_runs_source ON content_source_runs(source_id, started_at DESC);

-- ── Compiled dataset: Monetisation ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monetisation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_item_id UUID REFERENCES content_raw_items(id) ON DELETE SET NULL,
  topic VARCHAR(30) NOT NULL,        -- 'archive' | 'crawlers' | 'aeo' | 'bargaining' | 'general'
  item_type VARCHAR(30),             -- 'article' | 'case_study' | 'guide' | 'tool' | 'report' | 'news'
  title TEXT NOT NULL,
  summary TEXT,                      -- AI-written 1–3 sentence summary
  url TEXT,
  source_name VARCHAR(300),
  author TEXT,
  published_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  relevance NUMERIC(3,2),            -- AI relevance 0–1
  status VARCHAR(20) NOT NULL DEFAULT 'review',   -- 'review' | 'published' | 'rejected'
  rag_synced BOOLEAN NOT NULL DEFAULT false,
  rag_synced_at TIMESTAMPTZ,
  knowledge_entry_id UUID,           -- the knowledge_entries row, once synced to RAG
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monetisation_items_topic  ON monetisation_items(topic);
CREATE INDEX IF NOT EXISTS idx_monetisation_items_status ON monetisation_items(status);
CREATE INDEX IF NOT EXISTS idx_monetisation_items_rag    ON monetisation_items(rag_synced);

-- ── Seed a few Monetisation starter sources (admin adds more in the UI) ──────
INSERT INTO content_sources (domain, name, kind, url, tags, run_frequency_hours) VALUES
  ('monetisation', 'Press Gazette', 'rss', 'https://pressgazette.co.uk/feed/', ARRAY['news','industry'], 24),
  ('monetisation', 'Nieman Lab', 'rss', 'https://www.niemanlab.org/feed/', ARRAY['research','industry'], 24),
  ('monetisation', 'The Fix (media)', 'rss', 'https://thefix.media/feed', ARRAY['strategy','industry'], 24),
  ('monetisation', 'Cloudflare Blog', 'rss', 'https://blog.cloudflare.com/rss/', ARRAY['crawlers','tech'], 24)
ON CONFLICT (domain, kind, url) DO NOTHING;
