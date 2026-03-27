CREATE TABLE cohort_courses (
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cohort_id, course_id)
);

CREATE INDEX idx_cohort_courses_cohort ON cohort_courses(cohort_id);
CREATE INDEX idx_cohort_courses_course ON cohort_courses(course_id);
