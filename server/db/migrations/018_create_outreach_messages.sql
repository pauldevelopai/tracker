CREATE TABLE outreach_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id),
  channel VARCHAR(50) NOT NULL DEFAULT 'email',
  subject VARCHAR(500),
  body TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  gmail_message_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outreach_messages_campaign ON outreach_messages(campaign_id);
CREATE INDEX idx_outreach_messages_contact ON outreach_messages(contact_id);
