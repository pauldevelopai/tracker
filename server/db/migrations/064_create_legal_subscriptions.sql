-- Public "watch this case / regulation" subscriptions with double-opt-in email.
-- Also powers the weekly digest (entity_kind='all', entity_id NULL).
-- Notifications are queued to ai_legal_notifications by a trigger on event
-- insert so we don't have to remember to fan out at every insert site.

CREATE TABLE IF NOT EXISTS ai_legal_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_kind VARCHAR(20) NOT NULL CHECK (entity_kind IN ('lawsuit', 'regulation', 'all')),
  -- NULL when entity_kind='all' (global digest). Otherwise the lawsuit/regulation UUID.
  entity_id UUID,
  email VARCHAR(320) NOT NULL,
  -- Double opt-in: subscription is inert until confirmed_at is set.
  confirmed_at   TIMESTAMPTZ,
  confirm_token     VARCHAR(64) NOT NULL,
  unsubscribe_token VARCHAR(64) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at   TIMESTAMPTZ,
  CHECK ((entity_kind = 'all' AND entity_id IS NULL) OR (entity_kind <> 'all' AND entity_id IS NOT NULL))
);

-- Fast lookup for the notification fan-out trigger.
CREATE INDEX IF NOT EXISTS idx_legal_subs_active
  ON ai_legal_subscriptions (entity_kind, entity_id)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_legal_subs_email ON ai_legal_subscriptions (LOWER(email));

-- One subscription per (email, entity) pair. Resubscribe is allowed after
-- unsubscribe (we wipe the old row on confirmed resubscribe in app code).
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_subs_unique
  ON ai_legal_subscriptions (
    LOWER(email), entity_kind, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_legal_subs_confirm_token     ON ai_legal_subscriptions (confirm_token);
CREATE INDEX IF NOT EXISTS idx_legal_subs_unsubscribe_token ON ai_legal_subscriptions (unsubscribe_token);


-- Outbound notification queue. Email provider worker reads status='queued'
-- rows, attempts delivery, sets status='sent'/'failed'. Retains 'sent' rows
-- for audit / dedup — dedup on (subscription_id, event_id) is enforced.
CREATE TABLE IF NOT EXISTS ai_legal_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES ai_legal_subscriptions(id) ON DELETE CASCADE,
  event_kind VARCHAR(20) NOT NULL CHECK (event_kind IN ('lawsuit_event', 'regulation_event')),
  event_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_legal_notifs_queued
  ON ai_legal_notifications (created_at)
  WHERE status = 'queued';

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_notifs_dedup
  ON ai_legal_notifications (subscription_id, event_id);


-- ── Trigger: fan out lawsuit events to per-case watchers ───────────────────
CREATE OR REPLACE FUNCTION fanout_lawsuit_event_notifications() RETURNS trigger AS $$
BEGIN
  INSERT INTO ai_legal_notifications (subscription_id, event_kind, event_id, status)
  SELECT s.id, 'lawsuit_event', NEW.id, 'queued'
    FROM ai_legal_subscriptions s
   WHERE s.confirmed_at IS NOT NULL
     AND s.unsubscribed_at IS NULL
     AND (
       (s.entity_kind = 'lawsuit'    AND s.entity_id = NEW.lawsuit_id)
       OR s.entity_kind = 'all'
     )
   ON CONFLICT (subscription_id, event_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fanout_lawsuit_events ON ai_lawsuit_events;
CREATE TRIGGER trg_fanout_lawsuit_events
  AFTER INSERT ON ai_lawsuit_events
  FOR EACH ROW EXECUTE FUNCTION fanout_lawsuit_event_notifications();


-- ── Trigger: fan out regulation events to per-regulation watchers ──────────
CREATE OR REPLACE FUNCTION fanout_regulation_event_notifications() RETURNS trigger AS $$
BEGIN
  INSERT INTO ai_legal_notifications (subscription_id, event_kind, event_id, status)
  SELECT s.id, 'regulation_event', NEW.id, 'queued'
    FROM ai_legal_subscriptions s
   WHERE s.confirmed_at IS NOT NULL
     AND s.unsubscribed_at IS NULL
     AND (
       (s.entity_kind = 'regulation' AND s.entity_id = NEW.regulation_id)
       OR s.entity_kind = 'all'
     )
   ON CONFLICT (subscription_id, event_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fanout_regulation_events ON ai_regulation_events;
CREATE TRIGGER trg_fanout_regulation_events
  AFTER INSERT ON ai_regulation_events
  FOR EACH ROW EXECUTE FUNCTION fanout_regulation_event_notifications();
