// Admin API for the generic content-ingestion pipeline (monetisation, tools, …).
// Mirrors /legal-sources but domain-parameterised. The unified /overview endpoint
// reports every pipeline's flow: coming in → published to users → synced to RAG.
import { Router } from 'express';
import pool from '../db/pool.js';
import { dispatchDueContentSources, dispatchContentSource } from '../services/content-ingest/dispatcher.js';
import { triageMonetisationPending } from '../services/content-ingest/triage-monetisation.js';

const router = Router();
const TRIAGERS = { monetisation: triageMonetisationPending };

async function count(sql, params = []) {
  try { const { rows } = await pool.query(sql, params); return Number(rows[0]?.n || 0); }
  catch { return 0; }
}

// ── Unified overview across every pipeline ──────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const domains = [];

    // Legal pipeline (existing ai_legal_* tables) — best-effort counts.
    domains.push({
      domain: 'legal', label: 'AI Legal',
      sources: { active: await count(`SELECT count(*)::int n FROM ai_legal_sources WHERE active`), total: await count(`SELECT count(*)::int n FROM ai_legal_sources`) },
      comingIn: await count(`SELECT count(*)::int n FROM ai_legal_raw_items WHERE triage_status IN ('pending','classified')`),
      toUsers: (await count(`SELECT count(*)::int n FROM ai_lawsuits`)) + (await count(`SELECT count(*)::int n FROM ai_regulations`)) + (await count(`SELECT count(*)::int n FROM ai_legal_usecases WHERE is_published`)),
      toRag: await count(`SELECT count(*)::int n FROM knowledge_entries WHERE source_type IN ('lawsuit','regulation','ai_lawsuit','ai_regulation')`),
      managed: false, // legal has its own page
    });

    // Generic content pipelines (content_* tables), per domain.
    const { rows: doms } = await pool.query(`SELECT DISTINCT domain FROM content_sources ORDER BY domain`);
    for (const { domain } of doms) {
      const row = {
        domain, label: domain.charAt(0).toUpperCase() + domain.slice(1), managed: true,
        sources: {
          active: await count(`SELECT count(*)::int n FROM content_sources WHERE domain=$1 AND active`, [domain]),
          total: await count(`SELECT count(*)::int n FROM content_sources WHERE domain=$1`, [domain]),
        },
        comingIn: await count(`SELECT count(*)::int n FROM content_raw_items WHERE domain=$1 AND triage_status IN ('pending','classified')`, [domain]),
        toUsers: 0, toRag: 0, inReview: 0,
      };
      if (domain === 'monetisation') {
        row.inReview = await count(`SELECT count(*)::int n FROM monetisation_items WHERE status='review'`);
        row.toUsers = await count(`SELECT count(*)::int n FROM monetisation_items WHERE status='published'`);
        row.toRag = await count(`SELECT count(*)::int n FROM monetisation_items WHERE rag_synced`);
      }
      domains.push(row);
    }
    res.json({ domains });
  } catch (err) { console.error(err); res.status(500).json({ message: 'overview failed' }); }
});

// ── Sources ─────────────────────────────────────────────────────────────────
router.get('/sources', async (req, res) => {
  const { domain } = req.query;
  const params = []; let where = '';
  if (domain) { params.push(domain); where = `WHERE domain = $1`; }
  const { rows } = await pool.query(`SELECT * FROM content_sources ${where} ORDER BY domain, name`, params);
  res.json(rows);
});

router.post('/sources', async (req, res) => {
  const { domain, name, kind, url, tags = [], run_frequency_hours = 24, config = {}, active = true } = req.body;
  if (!domain || !name || !kind || !url) return res.status(400).json({ message: 'domain, name, kind, url required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO content_sources (domain, name, kind, url, tags, run_frequency_hours, config, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
      [domain, name, kind, url, tags, run_frequency_hours, JSON.stringify(config), active]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/sources/:id', async (req, res) => {
  const fields = ['name', 'kind', 'url', 'tags', 'run_frequency_hours', 'config', 'active'];
  const sets = [], params = [];
  for (const f of fields) if (f in req.body) { params.push(f === 'config' ? JSON.stringify(req.body[f]) : req.body[f]); sets.push(`${f} = $${params.length}${f === 'config' ? '::jsonb' : ''}`); }
  if (!sets.length) return res.status(400).json({ message: 'no fields' });
  params.push(req.params.id);
  const { rows } = await pool.query(`UPDATE content_sources SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
  res.json(rows[0]);
});

router.delete('/sources/:id', async (req, res) => {
  await pool.query('DELETE FROM content_sources WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/sources/:id/run', async (req, res) => {
  try { res.json(await dispatchContentSource(req.params.id)); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/run-due', async (req, res) => {
  try { res.json({ runs: await dispatchDueContentSources({ domain: req.body?.domain || null, limit: 20 }) }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/triage', async (req, res) => {
  const domain = req.body?.domain;
  const triager = TRIAGERS[domain];
  if (!triager) return res.status(400).json({ message: `No triager for domain '${domain}'` });
  try { res.json(await triager({ limit: 30 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Raw items queue ─────────────────────────────────────────────────────────
router.get('/raw-items', async (req, res) => {
  const { domain, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1), pageSize = 30;
  const params = []; const conds = [];
  if (domain) { params.push(domain); conds.push(`domain = $${params.length}`); }
  if (status) { params.push(status); conds.push(`triage_status = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total = await count(`SELECT count(*)::int n FROM content_raw_items ${where}`, params);
  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await pool.query(
    `SELECT id, domain, title, url, author, published_at, fetched_at, triage_status, triage_result
       FROM content_raw_items ${where} ORDER BY fetched_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ items: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// ── Compiled Monetisation items ─────────────────────────────────────────────
router.get('/items', async (req, res) => {
  const { domain = 'monetisation', status, topic } = req.query;
  if (domain !== 'monetisation') return res.json({ items: [] });
  const params = []; const conds = [];
  if (status) { params.push(status); conds.push(`status = $${params.length}`); }
  if (topic) { params.push(topic); conds.push(`topic = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM monetisation_items ${where} ORDER BY created_at DESC LIMIT 200`, params);
  res.json({ items: rows });
});

router.post('/items/:id/publish', async (req, res) => {
  const { rows } = await pool.query(`UPDATE monetisation_items SET status='published', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
  res.json(rows[0] || {});
});

router.post('/items/:id/reject', async (req, res) => {
  const { rows } = await pool.query(`UPDATE monetisation_items SET status='rejected', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
  res.json(rows[0] || {});
});

// Sync a compiled item into the RAG knowledge base. The existing embedding job
// picks up the new knowledge_entries row and vectorises it.
router.post('/items/:id/rag-sync', async (req, res) => {
  try {
    const { rows: irows } = await pool.query('SELECT * FROM monetisation_items WHERE id = $1', [req.params.id]);
    const item = irows[0];
    if (!item) return res.status(404).json({ message: 'not found' });
    const { rows: krows } = await pool.query(
      `INSERT INTO knowledge_entries (category, subcategory, title, content, source_type, source_id, source_description, confidence, is_verified, is_active)
       VALUES ('monetisation', $1, $2, $3, 'monetisation_item', $4, $5, $6, true, true) RETURNING id`,
      [item.topic, item.title.slice(0, 500), (item.summary || item.title) + (item.url ? `\n\nSource: ${item.url}` : ''),
       item.id, (item.url || '').slice(0, 500), item.relevance || 0.5]
    );
    await pool.query(`UPDATE monetisation_items SET rag_synced=true, rag_synced_at=NOW(), knowledge_entry_id=$1, updated_at=NOW() WHERE id=$2`, [krows[0].id, item.id]);
    res.json({ ok: true, knowledge_entry_id: krows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }); }
});

export default router;
