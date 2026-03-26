CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES team_members(id),
  title VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_conversations_type ON agent_conversations(agent_type);
CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);
