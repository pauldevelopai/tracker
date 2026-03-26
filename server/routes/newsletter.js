import { Router } from 'express';
import pool from '../db/pool.js';
import { createKnowledgeEntry } from '../services/knowledge.js';
import { generateDailyDigest } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { date, curriculum, category, limit } = req.query;
    let query = 'SELECT * FROM newsletter_items WHERE 1=1';
    const params = [];
    if (date) { params.push(date); query += ` AND digest_date::date = $${params.length}::date`; }
    if (curriculum === 'true') query += ' AND is_curriculum_relevant = true';
    if (category) { params.push(category); query += ` AND category = $${params.length}`; }
    query += ' ORDER BY received_at DESC';
    params.push(parseInt(limit) || 50);
    query += ` LIMIT $${params.length}`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get digest for a specific date (from archive)
router.get('/digest/:date', async (req, res) => {
  try {
    // Get current digest for this date
    const { rows: digests } = await pool.query(
      'SELECT * FROM newsletter_digests WHERE digest_date = $1 AND is_current = true ORDER BY version DESC LIMIT 1',
      [req.params.date]
    );

    // Get items for this date
    const { rows: items } = await pool.query(
      'SELECT * FROM newsletter_items WHERE digest_date::date = $1::date ORDER BY is_curriculum_relevant DESC, category, received_at',
      [req.params.date]
    );

    res.json({
      date: req.params.date,
      digest: digests[0]?.content || null,
      items,
      total: items.length,
      curriculum_count: items.filter(i => i.is_curriculum_relevant).length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/curriculum', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM newsletter_items WHERE is_curriculum_relevant = true
       ORDER BY received_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/promote', async (req, res) => {
  try {
    const { rows: [item] } = await pool.query('SELECT * FROM newsletter_items WHERE id = $1', [req.params.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });

    let sectorId = null;
    if (item.relevant_sectors?.length > 0) {
      const { rows } = await pool.query('SELECT id FROM sectors WHERE name = ANY($1) LIMIT 1', [item.relevant_sectors]);
      sectorId = rows[0]?.id || null;
    }

    const knowledgeId = await createKnowledgeEntry({
      category: 'industry_trend',
      subcategory: item.category,
      title: item.summary?.split('.')[0] || item.subject,
      content: (item.summary || '') + (item.curriculum_relevance_reason ? '\n\nCurriculum impact: ' + item.curriculum_relevance_reason : ''),
      sectorId,
      sourceType: 'newsletter',
      sourceDescription: `Newsletter from ${item.sender}: ${item.subject}`,
      sourceUrl: item.source_url || null,
      confidence: 0.65,
      tags: ['newsletter', item.category, ...(item.relevant_sectors || []).map(s => s.toLowerCase())],
    });

    await pool.query('UPDATE newsletter_items SET promoted_to_knowledge = true WHERE id = $1', [req.params.id]);

    res.status(201).json({ knowledge_id: knowledgeId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { is_curriculum_relevant, curriculum_relevance_reason } = req.body;
    const { rows } = await pool.query(
      `UPDATE newsletter_items SET is_curriculum_relevant = COALESCE($1, is_curriculum_relevant),
       curriculum_relevance_reason = COALESCE($2, curriculum_relevance_reason)
       WHERE id = $3 RETURNING *`,
      [is_curriculum_relevant, curriculum_relevance_reason, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Regenerate or generate digest for a specific date
router.post('/regenerate-digest', async (req, res) => {
  try {
    const targetDate = req.body.date || new Date().toISOString().split('T')[0];
    const { rows: items } = await pool.query(
      'SELECT * FROM newsletter_items WHERE digest_date::date = $1::date ORDER BY is_curriculum_relevant DESC, category',
      [targetDate]
    );
    if (items.length === 0) return res.status(400).json({ message: `No items for ${targetDate} to generate from` });

    const digest = await generateDailyDigest(items);

    // Archive any existing current digest for this date
    await pool.query(
      `UPDATE newsletter_digests SET is_current = false WHERE digest_date = $1 AND is_current = true`,
      [targetDate]
    );

    // Get next version number
    const { rows: [{ max_version }] } = await pool.query(
      `SELECT COALESCE(MAX(version), 0) AS max_version FROM newsletter_digests WHERE digest_date = $1`,
      [targetDate]
    );

    // Insert new version as current
    await pool.query(
      `INSERT INTO newsletter_digests (digest_date, content, item_count, curriculum_count, version, is_current)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [targetDate, digest, items.length, items.filter(i => i.is_curriculum_relevant).length, (max_version || 0) + 1]
    );

    res.json({ digest, itemCount: items.length });
  } catch (err) {
    console.error('Regenerate digest error:', err);
    res.status(500).json({ message: err.message || 'Regeneration failed' });
  }
});

// Save edited digest content
router.put('/digest/:date', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'content required' });

    // Update the current version for this date
    const { rowCount } = await pool.query(
      `UPDATE newsletter_digests SET content = $1, updated_at = NOW() WHERE digest_date = $2 AND is_current = true`,
      [content, req.params.date]
    );
    if (rowCount === 0) {
      await pool.query(
        `INSERT INTO newsletter_digests (digest_date, content, item_count, curriculum_count, version, is_current)
         VALUES ($1, $2, 0, 0, 1, true)`,
        [req.params.date, content]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List all past digests (archive)
router.get('/archive', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT nd.id, nd.digest_date, nd.item_count, nd.curriculum_count, nd.created_at,
        nd.version, nd.is_current,
        LEFT(nd.content, 200) AS preview
      FROM newsletter_digests nd
      ORDER BY nd.digest_date DESC, nd.version DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/settings', async (req, res) => {
  res.json({ label: process.env.NEWSLETTER_LABEL || 'CATEGORY_FORUMS' });
});

export default router;
