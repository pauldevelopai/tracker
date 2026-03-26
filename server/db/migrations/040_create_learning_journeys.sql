CREATE TABLE learning_journeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  organisation_id UUID REFERENCES organisations(id),
  sector_id UUID REFERENCES sectors(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  started_at DATE DEFAULT CURRENT_DATE,
  overall_progress INTEGER DEFAULT 0,
  skill_level VARCHAR(20) DEFAULT 'beginner',
  ai_notes TEXT,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_journeys_contact ON learning_journeys(contact_id);
CREATE INDEX idx_learning_journeys_organisation ON learning_journeys(organisation_id);
