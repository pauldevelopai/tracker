-- Richer per-case analysis and knowledge base linkage
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS detailed_analysis TEXT;
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS knowledge_entry_id UUID;
ALTER TABLE ai_lawsuits ADD COLUMN IF NOT EXISTS analysis_generated_at TIMESTAMPTZ;
