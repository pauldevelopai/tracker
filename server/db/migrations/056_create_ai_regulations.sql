CREATE TABLE IF NOT EXISTS ai_regulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  regulation_name VARCHAR(500) NOT NULL,
  short_name VARCHAR(200),
  jurisdiction VARCHAR(200) NOT NULL,
  regulator VARCHAR(300),
  status VARCHAR(50) DEFAULT 'in_force',
  -- Statuses: 'proposed', 'draft', 'consultation', 'enacted', 'in_force', 'partial_force', 'amended', 'repealed', 'superseded'
  regulation_type VARCHAR(100),
  -- Types: 'statute', 'regulation', 'directive', 'guidance', 'executive_order', 'standard', 'voluntary_code', 'court_ruling'
  scope TEXT[] DEFAULT '{}',
  affected_sectors TEXT[] DEFAULT '{}',
  proposed_date DATE,
  enacted_date DATE,
  effective_date DATE,
  enforcement_date DATE,
  next_milestone DATE,
  next_milestone_notes TEXT,
  key_provisions TEXT[] DEFAULT '{}',
  penalties TEXT,
  extraterritorial_scope TEXT,
  official_url TEXT,
  source_url TEXT,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  detailed_analysis TEXT,
  analysis_generated_at TIMESTAMPTZ,
  curriculum_relevance TEXT,
  is_curriculum_relevant BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  knowledge_entry_id UUID,
  external_id VARCHAR(200),
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_regulations_jurisdiction ON ai_regulations(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_status ON ai_regulations(status);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_effective_date ON ai_regulations(effective_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_scope ON ai_regulations USING gin(scope);
CREATE INDEX IF NOT EXISTS idx_ai_regulations_tags ON ai_regulations USING gin(tags);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_regulations_short_name_jurisdiction ON ai_regulations(short_name, jurisdiction);
