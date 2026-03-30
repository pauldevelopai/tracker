-- Store all source article URLs per case (not just the most recent one)
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}';

-- Seed from existing single source_url where set
UPDATE ai_lawsuits
SET source_urls = ARRAY[source_url]
WHERE source_url IS NOT NULL AND array_length(source_urls, 1) IS NULL;
