CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id UUID NOT NULL REFERENCES sectors(id),
  organisation_id UUID REFERENCES organisations(id),
  name VARCHAR(255) NOT NULL,
  delivery_type VARCHAR(50) NOT NULL DEFAULT 'online_3x2hr',
  status VARCHAR(50) NOT NULL DEFAULT 'planned',
  start_date DATE,
  end_date DATE,
  trainer_id UUID REFERENCES team_members(id),
  max_participants INTEGER,
  cpd_hours DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cohorts_sector ON cohorts(sector_id);
CREATE INDEX idx_cohorts_organisation ON cohorts(organisation_id);
CREATE INDEX idx_cohorts_trainer ON cohorts(trainer_id);
