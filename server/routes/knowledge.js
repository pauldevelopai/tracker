import { Router } from 'express';
import pool from '../db/pool.js';
import { searchKnowledge, getKnowledgeStats, createKnowledgeEntry } from '../services/knowledge.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await getKnowledgeStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, sector_id } = req.query;
    if (!q) return res.status(400).json({ message: 'q required' });
    const results = await searchKnowledge(q, { sectorId: sector_id });
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, sector_id, verified, limit } = req.query;
    let query = `
      SELECT ke.*, s.name AS sector_name,
        (SELECT array_agg(tag) FROM knowledge_tags kt WHERE kt.knowledge_id = ke.id) AS tags
      FROM knowledge_entries ke
      LEFT JOIN sectors s ON ke.sector_id = s.id
      WHERE ke.is_active = true
    `;
    const params = [];
    if (category) { params.push(category); query += ` AND ke.category = $${params.length}`; }
    if (sector_id) { params.push(sector_id); query += ` AND (ke.sector_id = $${params.length} OR ke.sector_id IS NULL)`; }
    if (verified === 'true') query += ' AND ke.is_verified = true';
    query += ' ORDER BY ke.created_at DESC';
    params.push(parseInt(limit) || 50);
    query += ` LIMIT $${params.length}`;
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
      `SELECT ke.*, s.name AS sector_name, o.name AS organisation_name, c.title AS course_title,
        (SELECT array_agg(tag) FROM knowledge_tags kt WHERE kt.knowledge_id = ke.id) AS tags
       FROM knowledge_entries ke
       LEFT JOIN sectors s ON ke.sector_id = s.id
       LEFT JOIN organisations o ON ke.organisation_id = o.id
       LEFT JOIN courses c ON ke.course_id = c.id
       WHERE ke.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { category, subcategory, title, content, sector_id, organisation_id, course_id, tags, confidence } = req.body;
    if (!category || !title || !content) return res.status(400).json({ message: 'category, title, content required' });
    const id = await createKnowledgeEntry({
      category, subcategory, title, content,
      sectorId: sector_id, organisationId: organisation_id, courseId: course_id,
      sourceType: 'manual', sourceDescription: `Added by ${req.user.name}`,
      confidence: confidence || 0.7, tags,
    });
    const { rows } = await pool.query('SELECT * FROM knowledge_entries WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content, category, is_verified, is_active, confidence } = req.body;
    const { rows } = await pool.query(
      `UPDATE knowledge_entries SET
        title = COALESCE($1, title), content = COALESCE($2, content),
        category = COALESCE($3, category), is_verified = COALESCE($4, is_verified),
        is_active = COALESCE($5, is_active), confidence = COALESCE($6, confidence),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, content, category, is_verified, is_active, confidence, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI feedback on interactions
router.put('/interactions/:id/feedback', async (req, res) => {
  try {
    const { was_used, user_rating, feedback_notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE ai_interactions SET was_used = $1, user_rating = $2, feedback_notes = $3
       WHERE id = $4 RETURNING id`,
      [was_used, user_rating || null, feedback_notes || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
