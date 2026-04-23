-- The per-event fan-out triggers from 064 queue a notification per event
-- for entity_kind='all' subscribers too, which would spam them. Digest
-- subscribers get a weekly summary instead via server/services/email/digest.js,
-- so we scope the triggers to per-entity watchers only.

CREATE OR REPLACE FUNCTION fanout_lawsuit_event_notifications() RETURNS trigger AS $$
BEGIN
  INSERT INTO ai_legal_notifications (subscription_id, event_kind, event_id, status)
  SELECT s.id, 'lawsuit_event', NEW.id, 'queued'
    FROM ai_legal_subscriptions s
   WHERE s.confirmed_at IS NOT NULL
     AND s.unsubscribed_at IS NULL
     AND s.entity_kind = 'lawsuit'
     AND s.entity_id = NEW.lawsuit_id
   ON CONFLICT (subscription_id, event_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fanout_regulation_event_notifications() RETURNS trigger AS $$
BEGIN
  INSERT INTO ai_legal_notifications (subscription_id, event_kind, event_id, status)
  SELECT s.id, 'regulation_event', NEW.id, 'queued'
    FROM ai_legal_subscriptions s
   WHERE s.confirmed_at IS NOT NULL
     AND s.unsubscribed_at IS NULL
     AND s.entity_kind = 'regulation'
     AND s.entity_id = NEW.regulation_id
   ON CONFLICT (subscription_id, event_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
