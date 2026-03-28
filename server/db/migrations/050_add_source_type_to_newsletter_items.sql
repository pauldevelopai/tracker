-- Add source_type to distinguish email newsletters from web-scraped news
ALTER TABLE newsletter_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'email';
-- Make gmail_message_id non-unique so web items (with NULL) don't conflict
-- Web items use a generated unique key stored in gmail_message_id field
CREATE INDEX IF NOT EXISTS newsletter_items_source_type_idx ON newsletter_items (source_type);
