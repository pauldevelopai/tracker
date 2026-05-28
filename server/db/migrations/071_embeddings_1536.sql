-- Upgrade RAG embeddings from 384-dim (local all-MiniLM-L6-v2) to 1536-dim
-- (OpenAI text-embedding-3-small). The old vectors are dimensionally
-- incompatible, so drop + recreate the columns (NULLing all embeddings); the
-- embedding-backfill job then re-populates them with the new model.
--
-- After deploy, run the "embedding_backfill" job (or it runs on schedule) to
-- re-embed every active knowledge_entries / industry_intelligence row.

DROP INDEX IF EXISTS idx_knowledge_embedding;
DROP INDEX IF EXISTS idx_intelligence_embedding;

ALTER TABLE knowledge_entries     DROP COLUMN IF EXISTS embedding;
ALTER TABLE knowledge_entries     ADD COLUMN embedding vector(1536);
ALTER TABLE industry_intelligence DROP COLUMN IF EXISTS embedding;
ALTER TABLE industry_intelligence ADD COLUMN embedding vector(1536);

-- HNSW (cosine) — supports up to 2000 dims, so 1536 is fine.
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding    ON knowledge_entries     USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_intelligence_embedding ON industry_intelligence USING hnsw (embedding vector_cosine_ops);
