CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  delivery_type VARCHAR(50) NOT NULL DEFAULT 'both',
  version VARCHAR(20) DEFAULT 'v1.0',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  last_updated_by UUID REFERENCES team_members(id),
  effectiveness_score DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_sector ON courses(sector_id);
