CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  country VARCHAR(100),
  city VARCHAR(100),
  website VARCHAR(500),
  notes TEXT,
  relationship_stage VARCHAR(50) NOT NULL DEFAULT 'prospect',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organisations_sector ON organisations(sector_id);
