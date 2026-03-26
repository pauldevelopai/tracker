CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interaction_type VARCHAR(100) NOT NULL,
  sector_id UUID REFERENCES sectors(id),
  entity_type VARCHAR(50),
  entity_id UUID,
  knowledge_ids_used UUID[],
  input_summary VARCHAR(1000),
  output_text TEXT,
  output_tokens INTEGER,
  was_used BOOLEAN,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_edits TEXT,
  feedback_notes TEXT,
  user_id UUID REFERENCES team_members(id),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_interactions_type ON ai_interactions(interaction_type);
CREATE INDEX idx_ai_interactions_entity ON ai_interactions(entity_type, entity_id);
CREATE INDEX idx_ai_interactions_created ON ai_interactions(created_at DESC);
