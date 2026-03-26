import { Router } from 'express';
import pool from '../db/pool.js';
import { draftSocialPost } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT sp.*, s.name AS sector_name, s.colour AS sector_colour
      FROM social_posts sp
      LEFT JOIN sectors s ON sp.sector_id = s.id
      WHERE ($1::uuid IS NULL OR sp.sector_id = $1)
    `;
    const params = [req.sectorId];
    if (req.query.status) { params.push(req.query.status); query += ` AND sp.status = $${params.length}`; }
    if (req.query.platform) { params.push(req.query.platform); query += ` AND sp.platform = $${params.length}`; }
    query += ' ORDER BY sp.scheduled_for DESC NULLS LAST, sp.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sp.*, s.name AS sector_name FROM social_posts sp LEFT JOIN sectors s ON sp.sector_id = s.id WHERE sp.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Post not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, platform, content, status, scheduled_for, ai_generated } = req.body;
    if (!sector_id) return res.status(400).json({ message: 'sector_id required' });
    const { rows } = await pool.query(
      `INSERT INTO social_posts (sector_id, platform, content, status, scheduled_for, ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sector_id, platform || 'linkedin', content || null, status || 'draft', scheduled_for || null, ai_generated || false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { platform, content, status, scheduled_for, published_at } = req.body;
    const { rows } = await pool.query(
      `UPDATE social_posts SET
        platform = COALESCE($1, platform), content = COALESCE($2, content),
        status = COALESCE($3, status), scheduled_for = $4, published_at = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [platform, content, status, scheduled_for, published_at, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Post not found' });

    // Implicit feedback: published = AI-generated content was used
    if (status === 'published') {
      pool.query(
        `UPDATE ai_interactions SET was_used = true
         WHERE entity_type = 'social_post' AND entity_id = $1 AND was_used IS NULL`,
        [req.params.id]
      ).catch(() => {});
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM social_posts WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Post not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI generate
router.post('/ai-generate', async (req, res) => {
  try {
    const { sector_id, platform, topic } = req.body;
    if (!sector_id) return res.status(400).json({ message: 'sector_id required' });

    const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [sector_id]);
    const sectorName = rows[0]?.name || 'general';

    const content = await draftSocialPost(sectorName, platform || 'linkedin', topic);
    res.json({ content });
  } catch (err) {
    console.error('Social AI error:', err);
    res.status(500).json({ message: err.message || 'AI generation failed' });
  }
});

export default router;
