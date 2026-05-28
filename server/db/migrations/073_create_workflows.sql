-- Workflow engine (Builder) — Phase 1 foundation.
-- A workflow is a graph (definition JSONB) of "blocks" wired together. Blocks are
-- code-registered (Nodes now, the 4 tools next, agents later) — not rows here.
-- Adapted to this app's single-org model: owners/runners are team_members
-- (no multi-newsroom newsroom_id like the source platform).

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  trigger_phrase TEXT,
  -- Product-as-problem framing (User mode groups by problem, not by block):
  problem_statement TEXT,
  problem_category VARCHAR(80),
  user_instructions TEXT,
  -- The graph: { nodes:[{id, block, config}], edges:[{from:{node,field}, to:{node,field}}],
  --             inputs:[{name, to:{node,field}}], output:{node,field} }
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"inputs":[],"output":null}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',   -- 'draft' | 'published'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_slug ON workflows(slug);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  user_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,                                   -- the final workflow output
  node_outputs JSONB,                             -- per-block outputs (trace)
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id, created_at DESC);

-- Who (which team member) can run a published workflow in /run.
CREATE TABLE IF NOT EXISTS workflow_assignments (
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workflow_id, assigned_to)
);
