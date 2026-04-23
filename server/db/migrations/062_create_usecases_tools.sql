-- AI Legal use-case collector + tool/method directory.
-- Both are third-party artefacts we curate + actively collect — structured
-- similarly to lawsuits/regulations so the existing triage + scrape + insights
-- pipelines can be extended to populate them.

-- ── Use cases: how specific lawyers / firms are using AI ─────────────────────
CREATE TABLE IF NOT EXISTS ai_legal_usecases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_name           VARCHAR(300) NOT NULL,
  firm_type           VARCHAR(30),          -- biglaw | boutique | solo | inhouse | government | nonprofit | legaltech | other
  jurisdiction        VARCHAR(200),
  use_case_title      VARCHAR(500) NOT NULL,
  summary             TEXT,
  tools_used          TEXT[] DEFAULT '{}',  -- names of tools (loose free-text; can be linked to ai_legal_tools via name match)
  categories          TEXT[] DEFAULT '{}',  -- drafting | research | ediscovery | review | analytics | intake | compliance | legal-ops | training | other
  outcome             TEXT,                 -- free-text summary of what they achieved
  quantified_impact   VARCHAR(500),         -- e.g. "75% faster document review"
  source_url          TEXT NOT NULL,
  source_urls         TEXT[] NOT NULL DEFAULT '{}',
  source_name         VARCHAR(300),
  author              VARCHAR(300),
  published_at        TIMESTAMPTZ,
  verified_at         TIMESTAMPTZ,
  tags                TEXT[] DEFAULT '{}',
  is_published        BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usecases_firm         ON ai_legal_usecases(firm_name);
CREATE INDEX IF NOT EXISTS idx_usecases_firm_type    ON ai_legal_usecases(firm_type);
CREATE INDEX IF NOT EXISTS idx_usecases_jurisdiction ON ai_legal_usecases(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_usecases_categories   ON ai_legal_usecases USING gin(categories);
CREATE INDEX IF NOT EXISTS idx_usecases_tools_used   ON ai_legal_usecases USING gin(tools_used);
CREATE INDEX IF NOT EXISTS idx_usecases_tags         ON ai_legal_usecases USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_usecases_published    ON ai_legal_usecases(published_at DESC NULLS LAST);

-- ── Tools + methods directory ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_legal_tools (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(300) NOT NULL,
  kind                VARCHAR(20) NOT NULL DEFAULT 'tool',   -- tool | method | framework
  vendor              VARCHAR(300),
  category            VARCHAR(50),                           -- drafting | research | ediscovery | review | analytics | intake | compliance | legal-ops | translation | general
  description         TEXT,
  url                 TEXT,
  pricing             VARCHAR(30),                           -- free | freemium | paid | enterprise | null
  strengths           TEXT,
  limitations         TEXT,
  integrations        TEXT[] DEFAULT '{}',
  source_urls         TEXT[] NOT NULL DEFAULT '{}',
  logo_url            TEXT,
  tags                TEXT[] DEFAULT '{}',
  is_published        BOOLEAN NOT NULL DEFAULT true,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_legal_tools_unique UNIQUE (kind, name)
);

CREATE INDEX IF NOT EXISTS idx_tools_kind     ON ai_legal_tools(kind);
CREATE INDEX IF NOT EXISTS idx_tools_category ON ai_legal_tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_vendor   ON ai_legal_tools(vendor);
CREATE INDEX IF NOT EXISTS idx_tools_tags     ON ai_legal_tools USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_tools_pricing  ON ai_legal_tools(pricing);
