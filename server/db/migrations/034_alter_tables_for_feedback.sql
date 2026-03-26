ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS was_published BOOLEAN DEFAULT false;
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE needs_assessments ADD COLUMN IF NOT EXISTS knowledge_extracted BOOLEAN DEFAULT false;
