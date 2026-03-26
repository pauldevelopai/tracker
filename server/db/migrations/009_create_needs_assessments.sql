CREATE TABLE needs_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  organisation_id UUID REFERENCES organisations(id),
  contact_id UUID REFERENCES contacts(id),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  responses JSONB DEFAULT '[]',
  ai_analysis TEXT,
  recommended_tier VARCHAR(50),
  submitted_at TIMESTAMPTZ,
  analysed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_needs_assessments_sector ON needs_assessments(sector_id);
CREATE INDEX idx_needs_assessments_organisation ON needs_assessments(organisation_id);
