-- AI Ethics scraper domain — a new pipeline on the generic content tables (069),
-- mirroring data-security (077). Raw items land in content_raw_items (domain
-- 'ethics'); AI triage promotes the relevant ones into ethics_items (status
-- 'review') for admin to publish. Published items feed the public AI Ethics page
-- (/legal/ethics), grouped under the six ethics principles by `topic`.

CREATE TABLE IF NOT EXISTS ethics_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_item_id UUID REFERENCES content_raw_items(id) ON DELETE SET NULL,
  topic VARCHAR(30) NOT NULL,        -- matches the Ethics page principle ids:
                                     -- 'transparency'|'accuracy'|'sources'|'bias'|'labour'|'accountability'|'general'
  item_type VARCHAR(30),             -- 'policy' | 'guide' | 'report' | 'article' | 'news' | 'tool'
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
  knowledge_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ethics_items_topic  ON ethics_items(topic);
CREATE INDEX IF NOT EXISTS idx_ethics_items_status ON ethics_items(status);
CREATE INDEX IF NOT EXISTS idx_ethics_items_rag    ON ethics_items(rag_synced);

-- ── Seed starter sources (admin adds more in the Ingestion UI) ───────────────
-- High-signal feeds on AI ethics / responsible AI in journalism.
INSERT INTO content_sources (domain, name, kind, url, tags, run_frequency_hours) VALUES
  ('ethics', 'Nieman Lab', 'rss', 'https://www.niemanlab.org/feed/', ARRAY['research','industry'], 24),
  ('ethics', 'Poynter', 'rss', 'https://www.poynter.org/feed/', ARRAY['ethics','standards'], 24),
  ('ethics', 'Columbia Journalism Review', 'rss', 'https://www.cjr.org/feed', ARRAY['ethics','analysis'], 24),
  ('ethics', 'Reuters Institute', 'rss', 'https://reutersinstitute.politics.ox.ac.uk/rss.xml', ARRAY['research'], 24),
  ('ethics', 'Ethical Journalism Network', 'rss', 'https://ethicaljournalismnetwork.org/feed', ARRAY['ethics','standards'], 24)
ON CONFLICT (domain, kind, url) DO NOTHING;

-- ── Schedule the AI triage on the cron scheduler ────────────────────────────
-- Job name MUST match JOB_REGISTRY in services/background-jobs.js. Runs at :10
-- every 6h, after the :00 scrape that feeds it.
INSERT INTO background_jobs (name, description, cron_expression, is_enabled) VALUES
  ('ethics_triage', 'AI-classify scraped AI-ethics items into principles', '10 */6 * * *', true)
ON CONFLICT (name) DO NOTHING;
UPDATE background_jobs SET is_enabled = true, updated_at = NOW() WHERE name = 'ethics_triage';
