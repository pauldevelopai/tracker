CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES document_templates(id),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  organisation_id UUID REFERENCES organisations(id),
  assessment_id UUID REFERENCES needs_assessments(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  generated_by UUID REFERENCES team_members(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_documents_sector ON generated_documents(sector_id);
CREATE INDEX idx_generated_documents_organisation ON generated_documents(organisation_id);
