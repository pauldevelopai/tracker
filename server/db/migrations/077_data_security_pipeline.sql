-- Data Security scraper domain — a new pipeline on the generic content tables
-- (069). Mirrors the Monetisation compiled table: raw items land in
-- content_raw_items (domain 'data-security'), AI triage promotes the relevant
-- ones into data_security_items (status 'review') for admin to publish + sync
-- to RAG. The Ingestion admin (Scraper Dashboard → Ingestion) renders this
-- domain automatically once sources exist.

-- ── Compiled dataset: Data Security ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_security_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_item_id UUID REFERENCES content_raw_items(id) ON DELETE SET NULL,
  topic VARCHAR(30) NOT NULL,        -- 'source-protection' | 'device-security' | 'account-security' | 'surveillance' | 'data-protection' | 'general'
  item_type VARCHAR(30),             -- 'guide' | 'report' | 'tool' | 'news' | 'advisory' | 'article'
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
CREATE INDEX IF NOT EXISTS idx_data_security_items_topic  ON data_security_items(topic);
CREATE INDEX IF NOT EXISTS idx_data_security_items_status ON data_security_items(status);
CREATE INDEX IF NOT EXISTS idx_data_security_items_rag    ON data_security_items(rag_synced);

-- ── Seed starter sources (admin adds more in the Ingestion UI) ───────────────
-- High-signal feeds on digital/data security for newsrooms & journalists.
INSERT INTO content_sources (domain, name, kind, url, tags, run_frequency_hours) VALUES
  ('data-security', 'EFF Deeplinks', 'rss', 'https://www.eff.org/rss/updates.xml', ARRAY['surveillance','privacy'], 24),
  ('data-security', 'Citizen Lab', 'rss', 'https://citizenlab.ca/feed/', ARRAY['surveillance','spyware'], 24),
  ('data-security', 'Access Now', 'rss', 'https://www.accessnow.org/feed/', ARRAY['digital-rights','privacy'], 24),
  ('data-security', 'Freedom of the Press Foundation', 'rss', 'https://freedom.press/news/feed/', ARRAY['source-protection','tools'], 24),
  ('data-security', 'Committee to Protect Journalists', 'rss', 'https://cpj.org/feed/', ARRAY['journalist-safety','source-protection'], 24)
ON CONFLICT (domain, kind, url) DO NOTHING;

-- ── Schedule the AI triage on the cron scheduler ────────────────────────────
-- The shared content_sources_ingest job already scrapes ALL due sources (this
-- domain included). It just needs its own triager. Job name MUST match
-- JOB_REGISTRY in services/background-jobs.js. Runs at :50 every 6h, after the
-- :00 scrape that feeds it (monetisation :20, tools :40, data-security :50).
INSERT INTO background_jobs (name, description, cron_expression, is_enabled) VALUES
  ('data_security_triage', 'AI-classify scraped data-security items into topics', '50 */6 * * *', true)
ON CONFLICT (name) DO NOTHING;
UPDATE background_jobs SET is_enabled = true, updated_at = NOW() WHERE name = 'data_security_triage';
