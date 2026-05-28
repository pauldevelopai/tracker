-- Saved outputs from the operations tools (Fundraiser / Audience / Operations /
-- Security Audit), whether run from a tool workspace or inside a workflow.
CREATE TABLE IF NOT EXISTS tool_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool VARCHAR(60) NOT NULL,            -- block slug, e.g. 'tool-fundraiser'
  user_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  title TEXT,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tool_outputs_tool ON tool_outputs(tool, created_at DESC);
