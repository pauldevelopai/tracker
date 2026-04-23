-- Source mention cache: one row per (entity, URL). Every URL that appears
-- in a lawsuit or regulation's source_urls / official_url / case_url / events
-- gets crawled by the article scraper, and the extracted metadata
-- (title, author, publish_date, snippet, og:image) lands here.
--
-- Detail pages can now render "Sources" sections with rich cards instead
-- of bare URLs. Readers see exactly what's backing every claim.
CREATE TABLE IF NOT EXISTS ai_legal_source_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_kind  VARCHAR(20) NOT NULL,          -- 'lawsuit' | 'regulation'
  subject_id    UUID NOT NULL,
  url           TEXT NOT NULL,
  canonical_url TEXT,                          -- final URL after redirects / canonical tag
  host          VARCHAR(300),
  title         VARCHAR(800),
  author        VARCHAR(300),
  site_name     VARCHAR(200),
  description   TEXT,
  body_excerpt  TEXT,                          -- first ~800 chars of the article body
  image_url     TEXT,                          -- og:image or first article image
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_status   INTEGER,
  error         TEXT,                          -- null when successful
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_legal_source_mentions_unique UNIQUE (subject_kind, subject_id, url)
);

CREATE INDEX IF NOT EXISTS idx_ai_legal_source_mentions_subject ON ai_legal_source_mentions(subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS idx_ai_legal_source_mentions_host    ON ai_legal_source_mentions(host);
CREATE INDEX IF NOT EXISTS idx_ai_legal_source_mentions_pub     ON ai_legal_source_mentions(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_legal_source_mentions_fetched ON ai_legal_source_mentions(fetched_at);
CREATE INDEX IF NOT EXISTS idx_ai_legal_source_mentions_status  ON ai_legal_source_mentions(http_status);
