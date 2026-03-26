-- Allow multiple digest versions per day (archive old ones when regenerating)
ALTER TABLE newsletter_digests DROP CONSTRAINT IF EXISTS newsletter_digests_digest_date_key;
ALTER TABLE newsletter_digests ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE newsletter_digests ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT true;
