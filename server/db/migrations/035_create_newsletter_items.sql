CREATE TABLE newsletter_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gmail_message_id VARCHAR(255),
  sender VARCHAR(500),
  subject VARCHAR(500),
  received_at TIMESTAMPTZ,
  raw_text TEXT,
  summary TEXT,
  category VARCHAR(100),
  is_curriculum_relevant BOOLEAN DEFAULT false,
  curriculum_relevance_reason TEXT,
  relevant_sectors TEXT[],
  is_digested BOOLEAN DEFAULT false,
  digest_date DATE,
  promoted_to_knowledge BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_newsletter_gmail_id ON newsletter_items(gmail_message_id);
CREATE INDEX idx_newsletter_received ON newsletter_items(received_at DESC);
CREATE INDEX idx_newsletter_curriculum ON newsletter_items(is_curriculum_relevant);
CREATE INDEX idx_newsletter_digest ON newsletter_items(digest_date);
