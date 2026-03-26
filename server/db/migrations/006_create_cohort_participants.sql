CREATE TABLE cohort_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  status VARCHAR(50) NOT NULL DEFAULT 'enrolled',
  completion_date DATE,
  cpd_certificate_issued BOOLEAN NOT NULL DEFAULT false,
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 10),
  feedback_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_cohort_participants_unique ON cohort_participants(cohort_id, contact_id);
CREATE INDEX idx_cohort_participants_cohort ON cohort_participants(cohort_id);
