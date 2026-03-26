CREATE TABLE funding_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funder_id UUID REFERENCES funders(id),
  sector_id UUID REFERENCES sectors(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount_min DECIMAL,
  amount_max DECIMAL,
  currency VARCHAR(10) NOT NULL DEFAULT 'GBP',
  deadline TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'researching',
  pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'identified',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  match_funding_required BOOLEAN NOT NULL DEFAULT false,
  match_funding_amount DECIMAL,
  eligibility_notes TEXT,
  ai_research_notes TEXT,
  url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funding_opportunities_funder ON funding_opportunities(funder_id);
CREATE INDEX idx_funding_opportunities_sector ON funding_opportunities(sector_id);
CREATE INDEX idx_funding_opportunities_stage ON funding_opportunities(pipeline_stage);
