CREATE TABLE participant_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  token VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_participant_tokens_token ON participant_tokens(token);
CREATE INDEX idx_participant_tokens_contact ON participant_tokens(contact_id);
