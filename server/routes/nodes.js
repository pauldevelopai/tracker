/**
 * routes/nodes.js — GROUNDED Nodes telemetry + admin overview.
 *
 *   POST /api/nodes/beacon         (PUBLIC)  opt-in local-install heartbeat
 *   GET  /api/nodes/admin/overview (ADMIN)   per-newsroom hosted usage + feedback
 *                                            + opted-in local installs
 *
 * The beacon is the only inbound write a local install makes, and it's OFF by
 * default in the Node — a newsroom turns it on explicitly. We store ONLY the
 * minimal identified fields below; never story text, titles, or file names.
 *
 * Hosted usage + feedback already live in the box's Postgres: the hosted Node
 * (server-hosted.js + lib/pg-host.js) writes node_analytics_activity, scoped by
 * newsroom_id (= the signed-in team_members.id). Feedback is the rows with
 * kind='feedback' (message in the `response` column). This route just reads it.
 */

import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────
const str = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const intClamp = (v) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 10_000_000);
};

// Self-bootstrap node_beacons so the beacon works whether or not the SQL
// migration (066) has been run on this box yet. Idempotent; runs once.
let beaconTableReady = null;
function ensureBeaconTable() {
  if (!beaconTableReady) {
    beaconTableReady = pool.query(`
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
    `).catch((err) => { beaconTableReady = null; throw err; });
  }
  return beaconTableReady;
}

// ── POST /api/nodes/beacon — PUBLIC opt-in local-install heartbeat ───────────
router.post('/beacon', async (req, res) => {
  try {
    const b = req.body || {};
    const install_id = str(b.install_id, 80);
    const node_slug = str(b.node_slug, 40);
    if (!install_id || !/^[A-Za-z0-9._-]+$/.test(install_id)) {
      return res.status(400).json({ message: 'install_id required (alphanumeric / . _ -)' });
    }
    if (!node_slug) return res.status(400).json({ message: 'node_slug required' });

    const counts = b.counts || {};
    await ensureBeaconTable();
    await pool.query(
      `INSERT INTO node_beacons
         (install_id, node_slug, newsroom, node_version, runtime_version, os,
          ingests, briefs, errors, story_count, last_activity_at, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
       ON CONFLICT (install_id) DO UPDATE SET
         node_slug        = EXCLUDED.node_slug,
         newsroom         = EXCLUDED.newsroom,
         node_version     = EXCLUDED.node_version,
         runtime_version  = EXCLUDED.runtime_version,
         os               = EXCLUDED.os,
         ingests          = EXCLUDED.ingests,
         briefs           = EXCLUDED.briefs,
         errors           = EXCLUDED.errors,
         story_count      = EXCLUDED.story_count,
         last_activity_at = EXCLUDED.last_activity_at,
         last_seen        = NOW()`,
      [
        install_id, node_slug, str(b.newsroom, 120),
        str(b.node_version, 40), str(b.runtime_version, 40), str(b.os, 60),
        intClamp(counts.ingests), intClamp(counts.briefs), intClamp(counts.errors),
        intClamp(counts.story_count), str(b.last_activity_at, 40),
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[nodes/beacon]', err.message);
    res.status(500).json({ message: 'Could not record beacon' });
  }
});

// ── GET /api/nodes/admin/overview — ADMIN ────────────────────────────────────
router.get('/admin/overview', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // The hosted Node's tables are created by the Node itself, not by tracker
    // migrations — guard against them not existing yet on this box.
    const { rows: [reg] } = await pool.query(
      `SELECT to_regclass('public.node_analytics_activity') AS activity,
              to_regclass('public.node_analytics_stories')  AS stories`
    );

    let hosted = [];
    let feedback = [];
    let recent = [];
    if (reg.activity) {
      const usage = await pool.query(`
        SELECT a.newsroom_id,
               tm.name  AS member_name,
               tm.email AS member_email,
               COUNT(*) FILTER (WHERE a.kind = 'run' AND a.op = 'ingest') AS ingests,
               COUNT(*) FILTER (WHERE a.kind = 'run' AND a.op = 'brief')  AS briefs,
               COUNT(*) FILTER (WHERE a.kind = 'error')                   AS errors,
               COUNT(*) FILTER (WHERE a.kind = 'feedback')                AS feedback_count,
               MAX(a.ts) AS last_activity_at
        FROM node_analytics_activity a
        LEFT JOIN team_members tm ON tm.id::text = a.newsroom_id
        GROUP BY a.newsroom_id, tm.name, tm.email
        ORDER BY MAX(a.ts) DESC NULLS LAST
      `);
      hosted = usage.rows;

      if (reg.stories) {
        const story = await pool.query(`
          SELECT newsroom_id,
                 COUNT(*)                    AS stories,
                 COUNT(DISTINCT source_label) AS sources
          FROM node_analytics_stories
          GROUP BY newsroom_id
        `);
        const byId = new Map(story.rows.map((r) => [r.newsroom_id, r]));
        hosted = hosted.map((h) => ({
          ...h,
          stories: Number(byId.get(h.newsroom_id)?.stories || 0),
          sources: Number(byId.get(h.newsroom_id)?.sources || 0),
        }));
      }

      const fb = await pool.query(`
        SELECT a.newsroom_id,
               tm.name  AS member_name,
               tm.email AS member_email,
               a.ts, a.op, a.response AS message
        FROM node_analytics_activity a
        LEFT JOIN team_members tm ON tm.id::text = a.newsroom_id
        WHERE a.kind = 'feedback'
        ORDER BY a.ts DESC
        LIMIT 200
      `);
      feedback = fb.rows;

      const rec = await pool.query(`
        SELECT a.ts, a.kind, a.op, a.story_count, a.source,
               tm.email AS member_email
        FROM node_analytics_activity a
        LEFT JOIN team_members tm ON tm.id::text = a.newsroom_id
        ORDER BY a.ts DESC
        LIMIT 25
      `);
      recent = rec.rows;
    }

    await ensureBeaconTable();
    const { rows: local } = await pool.query(`
      SELECT install_id, node_slug, newsroom, node_version, runtime_version, os,
             ingests, briefs, errors, story_count, last_activity_at, first_seen, last_seen
      FROM node_beacons
      ORDER BY last_seen DESC
    `);

    res.json({ hosted, feedback, local, recent });
  } catch (err) {
    console.error('[nodes/admin/overview]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
