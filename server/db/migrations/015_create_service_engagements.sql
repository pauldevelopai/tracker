CREATE TABLE service_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  organisation_id UUID REFERENCES organisations(id),
  contact_id UUID REFERENCES contacts(id),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scoping',
  mentor_id UUID REFERENCES team_members(id),
  start_date DATE,
  end_date DATE,
  session_count INTEGER DEFAULT 0,
  deliverable_url VARCHAR(500),
  document_id UUID REFERENCES generated_documents(id),
  assessment_id UUID REFERENCES needs_assessments(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_engagements_sector ON service_engagements(sector_id);
CREATE INDEX idx_service_engagements_organisation ON service_engagements(organisation_id);
