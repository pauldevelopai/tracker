ALTER TABLE industry_intelligence ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000);
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000);
