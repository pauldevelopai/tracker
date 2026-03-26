CREATE TABLE learning_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID REFERENCES cohort_participants(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  cohort_id UUID REFERENCES cohorts(id),
  outcome_id UUID REFERENCES learning_outcomes(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) NOT NULL DEFAULT 'deliverable',
  difficulty VARCHAR(20) DEFAULT 'beginner',
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'assigned',
  submitted_at TIMESTAMPTZ,
  submission_text TEXT,
  submission_url VARCHAR(500),
  reviewer_id UUID REFERENCES team_members(id),
  review_notes TEXT,
  review_score INTEGER CHECK (review_score >= 1 AND review_score <= 5),
  ai_review TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_tasks_contact ON learning_tasks(contact_id);
CREATE INDEX idx_learning_tasks_cohort ON learning_tasks(cohort_id);
CREATE INDEX idx_learning_tasks_outcome ON learning_tasks(outcome_id);
CREATE INDEX idx_learning_tasks_status ON learning_tasks(status);
