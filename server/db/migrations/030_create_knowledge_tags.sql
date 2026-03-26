CREATE TABLE knowledge_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_tags_knowledge ON knowledge_tags(knowledge_id);
CREATE INDEX idx_knowledge_tags_tag ON knowledge_tags(tag);
CREATE UNIQUE INDEX idx_knowledge_tags_unique ON knowledge_tags(knowledge_id, tag);
