CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(200) NOT NULL UNIQUE,
  name VARCHAR(300) NOT NULL,
  url TEXT,
  primary_category VARCHAR(200),
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  purpose TEXT,
  cdi_cost SMALLINT,
  cdi_difficulty SMALLINT,
  cdi_invasiveness SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_primary_category ON tools(primary_category);
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
