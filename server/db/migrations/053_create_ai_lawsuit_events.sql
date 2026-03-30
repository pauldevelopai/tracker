-- Per-case event history for AI lawsuit tracker
CREATE TABLE IF NOT EXISTS ai_lawsuit_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawsuit_id    UUID NOT NULL REFERENCES ai_lawsuits(id) ON DELETE CASCADE,
  event_date    DATE,
  event_type    VARCHAR(50) NOT NULL DEFAULT 'update',
  -- Types: filing, hearing, ruling, settlement, dismissal, decision, appeal, amendment, update
  title         VARCHAR(500),
  description   TEXT,
  source_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawsuit_events_lawsuit_id ON ai_lawsuit_events(lawsuit_id);
CREATE INDEX IF NOT EXISTS idx_lawsuit_events_date ON ai_lawsuit_events(event_date DESC NULLS LAST);

-- Seed: filing events from existing cases
INSERT INTO ai_lawsuit_events (lawsuit_id, event_date, event_type, title, description)
SELECT
  id,
  filing_date,
  'filing',
  'Case filed',
  CONCAT(
    'Filed in ', COALESCE(court, jurisdiction, 'federal court'),
    CASE WHEN judge IS NOT NULL THEN CONCAT(' before Judge ', judge) ELSE '' END,
    CASE WHEN array_length(plaintiffs, 1) > 0 THEN CONCAT(' by ', array_to_string(plaintiffs, ', ')) ELSE '' END,
    CASE WHEN array_length(defendants, 1) > 0 THEN CONCAT(' against ', array_to_string(defendants, ', ')) ELSE '' END
  )
FROM ai_lawsuits
WHERE filing_date IS NOT NULL;

-- Seed: outcome / status events for resolved cases
INSERT INTO ai_lawsuit_events (lawsuit_id, event_date, event_type, title, description)
SELECT
  id,
  last_update,
  CASE status
    WHEN 'settled'   THEN 'settlement'
    WHEN 'dismissed' THEN 'dismissal'
    WHEN 'decided'   THEN 'decision'
    WHEN 'appealing' THEN 'appeal'
    ELSE 'update'
  END,
  CASE status
    WHEN 'settled'   THEN 'Case settled'
    WHEN 'dismissed' THEN 'Case dismissed'
    WHEN 'decided'   THEN 'Decision issued'
    WHEN 'appealing' THEN 'Appeal filed'
    ELSE 'Case update'
  END,
  COALESCE(
    outcome,
    CONCAT(
      'Status changed to: ', status,
      CASE WHEN settlement_amount IS NOT NULL THEN CONCAT(' — ', settlement_amount) ELSE '' END
    )
  )
FROM ai_lawsuits
WHERE last_update IS NOT NULL
  AND (status != 'active' OR outcome IS NOT NULL);
