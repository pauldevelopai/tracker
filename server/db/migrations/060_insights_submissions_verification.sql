-- AI Legal: insights, user submissions, and source-verification flags.

-- ── Per-event source-verification flags ─────────────────────────────────────
-- When an event has a verified (HTTP-resolvable) source URL we set source_verified_at.
-- Events without a verified source should be treated as "unverified" on the
-- public UI — so readers always know what's primary-source-backed.
ALTER TABLE ai_lawsuit_events    ADD COLUMN IF NOT EXISTS source_verified_at TIMESTAMPTZ;
ALTER TABLE ai_regulation_events ADD COLUMN IF NOT EXISTS source_verified_at TIMESTAMPTZ;

-- ── Insights: industry impact + predicted outcome per entity ────────────────
-- One row per (entity, insight_type). Re-generating overwrites the prior row.
-- Citations are a JSONB array of { kind, id, name, url } objects pointing to
-- the cases / regulations / knowledge entries the model referenced — users can
-- click through to verify each claim.
CREATE TABLE IF NOT EXISTS ai_legal_insights (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_kind   VARCHAR(20) NOT NULL,            -- 'lawsuit' | 'regulation'
  subject_id     UUID NOT NULL,
  insight_type   VARCHAR(30) NOT NULL,            -- 'industry_impact' | 'predicted_outcome' | 'precedent_analysis'
  content        TEXT NOT NULL,
  citations      JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_used     VARCHAR(100),
  confidence     NUMERIC(3,2),                    -- 0.00 – 1.00 self-reported by Claude
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_legal_insights_unique UNIQUE (subject_kind, subject_id, insight_type)
);
CREATE INDEX IF NOT EXISTS idx_ai_legal_insights_subject ON ai_legal_insights(subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS idx_ai_legal_insights_type    ON ai_legal_insights(insight_type);

-- ── User submissions (public → admin moderation queue) ──────────────────────
CREATE TABLE IF NOT EXISTS ai_legal_user_submissions (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_kind            VARCHAR(20) NOT NULL DEFAULT 'lawsuit',  -- 'lawsuit' | 'regulation' | 'event'
  case_name                  VARCHAR(500),
  jurisdiction               VARCHAR(200),
  parties                    TEXT,
  source_url                 TEXT NOT NULL,
  summary                    TEXT,
  submitter_email            VARCHAR(300),
  submitter_ip               VARCHAR(45),
  submitter_ua               TEXT,
  status                     VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | duplicate
  review_notes               TEXT,
  reviewed_by                UUID,
  reviewed_at                TIMESTAMPTZ,
  promoted_to_lawsuit_id     UUID REFERENCES ai_lawsuits(id)    ON DELETE SET NULL,
  promoted_to_regulation_id  UUID REFERENCES ai_regulations(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_legal_user_submissions_status  ON ai_legal_user_submissions(status);
CREATE INDEX IF NOT EXISTS idx_ai_legal_user_submissions_created ON ai_legal_user_submissions(created_at DESC);
