CREATE TABLE industry_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID REFERENCES sectors(id),
  category VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  source VARCHAR(500),
  source_url VARCHAR(1000),
  relevance_score DECIMAL(3,2),
  is_actionable BOOLEAN DEFAULT false,
  action_taken TEXT,
  reviewed_by UUID REFERENCES team_members(id),
  reviewed_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intelligence_sector ON industry_intelligence(sector_id);
CREATE INDEX idx_intelligence_category ON industry_intelligence(category);
CREATE INDEX idx_intelligence_active ON industry_intelligence(is_active, category);
CREATE INDEX idx_intelligence_text ON industry_intelligence
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '')));
