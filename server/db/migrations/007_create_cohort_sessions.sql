CREATE TABLE cohort_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  session_date DATE,
  start_time TIME,
  end_time TIME,
  location VARCHAR(255),
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cohort_sessions_cohort ON cohort_sessions(cohort_id);
