-- Performance: richer indexing on ai_lawsuits and ai_regulations so the
-- public/admin filters (jurisdiction, case_type, dates, key issues, tags,
-- free-text) hit an index instead of a sequential scan.

-- ── ai_lawsuits: extra B-tree / GIN indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_jurisdiction ON ai_lawsuits(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_case_type ON ai_lawsuits(case_type);
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_filing_date ON ai_lawsuits(filing_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_last_update ON ai_lawsuits(last_update DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_plaintiffs ON ai_lawsuits USING gin(plaintiffs);
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_key_issues ON ai_lawsuits USING gin(key_issues);
CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_tags ON ai_lawsuits USING gin(tags);

-- ── ai_regulations: extra indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_regulations_regulation_type ON ai_regulations(regulation_type);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_affected_sectors ON ai_regulations USING gin(affected_sectors);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_key_provisions ON ai_regulations USING gin(key_provisions);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_enforcement_date ON ai_regulations(enforcement_date DESC NULLS LAST);

-- ── Full-text search columns + triggers ──────────────────────────────────────
-- Postgres won't accept to_tsvector() in a GENERATED STORED expression (not
-- strictly immutable), so we use the classic trigger pattern.

ALTER TABLE ai_lawsuits    ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE ai_regulations ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE OR REPLACE FUNCTION ai_lawsuits_search_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.case_name, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.plaintiffs, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.defendants, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.key_issues, '{}'), ' ')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_lawsuits_search_tsv_update ON ai_lawsuits;
CREATE TRIGGER ai_lawsuits_search_tsv_update
BEFORE INSERT OR UPDATE OF case_name, plaintiffs, defendants, summary, key_issues
ON ai_lawsuits
FOR EACH ROW EXECUTE FUNCTION ai_lawsuits_search_tsv_trigger();

CREATE OR REPLACE FUNCTION ai_regulations_search_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.regulation_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.short_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.jurisdiction, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.regulator, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.key_provisions, '{}'), ' ')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_regulations_search_tsv_update ON ai_regulations;
CREATE TRIGGER ai_regulations_search_tsv_update
BEFORE INSERT OR UPDATE OF regulation_name, short_name, jurisdiction, regulator, summary, key_provisions
ON ai_regulations
FOR EACH ROW EXECUTE FUNCTION ai_regulations_search_tsv_trigger();

-- Backfill search_tsv for existing rows (trigger only fires on insert/update of the listed cols).
UPDATE ai_lawsuits    SET case_name = case_name;
UPDATE ai_regulations SET regulation_name = regulation_name;

CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_search_tsv    ON ai_lawsuits    USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_search_tsv ON ai_regulations USING gin(search_tsv);

-- ── Importance scoring scaffolding ────────────────────────────────────────────
-- Columns to hold a computed or human-curated importance score (0.00–100.00),
-- the reasoning behind the score, the raw signals used, and when it was scored.
-- Populated later by the importance-screening system (Phase A8).

ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS importance_score NUMERIC(5,2);
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS importance_reasoning TEXT;
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS importance_signals JSONB;
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS importance_scored_at TIMESTAMPTZ;

ALTER TABLE ai_regulations ADD COLUMN IF NOT EXISTS importance_score NUMERIC(5,2);
ALTER TABLE ai_regulations ADD COLUMN IF NOT EXISTS importance_reasoning TEXT;
ALTER TABLE ai_regulations ADD COLUMN IF NOT EXISTS importance_signals JSONB;
ALTER TABLE ai_regulations ADD COLUMN IF NOT EXISTS importance_scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_lawsuits_importance    ON ai_lawsuits   (importance_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_importance ON ai_regulations(importance_score DESC NULLS LAST);
