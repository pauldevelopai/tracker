-- A cohort can have MULTIPLE organisations (not just one)
-- Keep the existing organisation_id as the "client" (funder) for the cohort
-- Add a join table for the orgs being trained in this cohort
ALTER TABLE cohorts RENAME COLUMN organisation_id TO client_organisation_id;

CREATE TABLE cohort_organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cohort_id, organisation_id)
);

CREATE INDEX idx_cohort_organisations_cohort ON cohort_organisations(cohort_id);
CREATE INDEX idx_cohort_organisations_org ON cohort_organisations(organisation_id);
