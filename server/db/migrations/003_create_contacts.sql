CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  job_title VARCHAR(200),
  organisation_id UUID REFERENCES organisations(id),
  linkedin_url VARCHAR(500),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'prospect',
  source VARCHAR(100),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_sector ON contacts(sector_id);
CREATE INDEX idx_contacts_organisation ON contacts(organisation_id);
