-- node_beacons — opt-in, identified local-install telemetry for GROUNDED Nodes.
--
-- A newsroom that runs a Node on its own machine can opt IN (default OFF) to
-- share minimal usage so Paul can see download/local-install activity in the
-- tracker's Nodes admin. The Node POSTs to /api/nodes/beacon. We store ONLY
-- the fields below — never story text, titles, or file names. One row per
-- install_id (a random id the install generates and keeps locally); re-pings
-- upsert this row rather than appending.
CREATE TABLE IF NOT EXISTS node_beacons (
  install_id       TEXT PRIMARY KEY,
  node_slug        TEXT NOT NULL,
  newsroom         TEXT,
  node_version     TEXT,
  runtime_version  TEXT,
  os               TEXT,
  ingests          INTEGER NOT NULL DEFAULT 0,
  briefs           INTEGER NOT NULL DEFAULT 0,
  errors           INTEGER NOT NULL DEFAULT 0,
  story_count      INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS node_beacons_slug ON node_beacons (node_slug);
