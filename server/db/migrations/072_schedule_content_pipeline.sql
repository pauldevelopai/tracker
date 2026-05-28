-- Put the content pipeline (scrape → AI triage → embed → knowledge sync) on the
-- cron scheduler so the RAG keeps itself populated and current with no clicking.
-- Job names MUST match JOB_REGISTRY in services/background-jobs.js. The scheduler
-- loads enabled rows on startup. Times are Europe/London (scheduler default).
--
-- Cadence (offset so triage runs after the scrape that feeds it):
--   :00 every 6h  — scrape due content sources (monetisation + tools)
--   :20 every 6h  — AI-classify monetisation items into topics
--   :40 every 6h  — AI-extract open-source tools
--   :15 hourly    — embed any knowledge entries missing a vector (RAG fill)
--   03:00 daily   — push lawsuits/regulations into the RAG knowledge base

INSERT INTO background_jobs (name, description, cron_expression, is_enabled) VALUES
  ('content_sources_ingest', 'Scrape due content sources (monetisation, tools)',        '0 */6 * * *',  true),
  ('monetisation_triage',    'AI-classify scraped monetisation items into topics',      '20 */6 * * *', true),
  ('tools_triage',           'AI-extract open-source tools from scraped items',         '40 */6 * * *', true),
  ('knowledge_sync',         'Sync lawsuits/regulations into the RAG knowledge base',   '0 3 * * *',    true),
  ('embedding_backfill',     'Embed knowledge entries that are missing a vector',       '15 * * * *',   true)
ON CONFLICT (name) DO NOTHING;

-- The user opted into automation: make sure these are enabled even if a row
-- pre-existed in a disabled state.
UPDATE background_jobs SET is_enabled = true, updated_at = NOW()
 WHERE name IN ('content_sources_ingest','monetisation_triage','tools_triage','knowledge_sync','embedding_backfill');
