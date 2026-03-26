CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE industry_intelligence ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Use HNSW index (works even with few rows, unlike IVFFlat)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_intelligence_embedding ON industry_intelligence USING hnsw (embedding vector_cosine_ops);
