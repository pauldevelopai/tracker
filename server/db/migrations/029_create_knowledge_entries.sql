CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  sector_id UUID REFERENCES sectors(id),
  organisation_id UUID REFERENCES organisations(id),
  course_id UUID REFERENCES courses(id),
  source_type VARCHAR(100) NOT NULL,
  source_id UUID,
  source_description VARCHAR(500),
  confidence DECIMAL(3,2) DEFAULT 0.5,
  is_verified BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_category ON knowledge_entries(category);
CREATE INDEX idx_knowledge_sector ON knowledge_entries(sector_id);
CREATE INDEX idx_knowledge_org ON knowledge_entries(organisation_id);
CREATE INDEX idx_knowledge_course ON knowledge_entries(course_id);
CREATE INDEX idx_knowledge_active ON knowledge_entries(is_active, category);
CREATE INDEX idx_knowledge_source ON knowledge_entries(source_type, source_id);
CREATE INDEX idx_knowledge_text ON knowledge_entries
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));
