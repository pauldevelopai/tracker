CREATE TABLE funding_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  title VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'drafting',
  submitted_at TIMESTAMPTZ,
  decision_at TIMESTAMPTZ,
  amount_requested DECIMAL,
  amount_awarded DECIMAL,
  content TEXT,
  budget_breakdown JSONB DEFAULT '[]',
  assigned_to UUID REFERENCES team_members(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funding_applications_opportunity ON funding_applications(opportunity_id);
