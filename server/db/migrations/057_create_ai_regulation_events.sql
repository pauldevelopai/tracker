CREATE TABLE IF NOT EXISTS ai_regulation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  regulation_id UUID NOT NULL REFERENCES ai_regulations(id) ON DELETE CASCADE,
  event_date DATE,
  event_type VARCHAR(50) NOT NULL DEFAULT 'update',
  -- Types: proposed, consultation, enacted, amended, took_effect, enforcement_action, guidance_issued, repealed, superseded, update
  title VARCHAR(500),
  description TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regulation_events_regulation_id ON ai_regulation_events(regulation_id);
CREATE INDEX IF NOT EXISTS idx_regulation_events_date ON ai_regulation_events(event_date DESC NULLS LAST);
