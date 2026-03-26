import { Router } from 'express';
import pool from '../db/pool.js';
import { createKnowledgeEntry } from '../services/knowledge.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { sector_id, category, actionable } = req.query;
    let query = `
      SELECT ii.*, s.name AS sector_name
      FROM industry_intelligence ii
      LEFT JOIN sectors s ON ii.sector_id = s.id
      WHERE ii.is_active = true
    `;
    const params = [];
    if (sector_id) { params.push(sector_id); query += ` AND ii.sector_id = $${params.length}`; }
    if (category) { params.push(category); query += ` AND ii.category = $${params.length}`; }
    if (actionable === 'true') query += ' AND ii.is_actionable = true AND ii.action_taken IS NULL';
    query += ' ORDER BY ii.discovered_at DESC LIMIT 100';
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
      `SELECT ii.*, s.name AS sector_name FROM industry_intelligence ii
       LEFT JOIN sectors s ON ii.sector_id = s.id WHERE ii.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { action_taken, is_actionable } = req.body;
    const { rows } = await pool.query(
      `UPDATE industry_intelligence SET action_taken = $1, is_actionable = COALESCE($2, is_actionable),
       reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [action_taken, is_actionable, req.user.id, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/knowledge', async (req, res) => {
  try {
    const { rows: [item] } = await pool.query('SELECT * FROM industry_intelligence WHERE id = $1', [req.params.id]);
    if (!item) return res.status(404).json({ message: 'Not found' });

    const knowledgeId = await createKnowledgeEntry({
      category: 'industry_trend',
      subcategory: item.category,
      title: item.title,
      content: item.summary + (item.details ? '\n\n' + item.details : ''),
      sectorId: item.sector_id,
      sourceType: 'intelligence_promotion',
      sourceId: item.id,
      sourceDescription: `Promoted from industry intelligence: ${item.source || 'background research'}`,
      confidence: item.relevance_score || 0.7,
      tags: [item.category, 'intelligence'],
    });

    res.status(201).json({ knowledge_id: knowledgeId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE industry_intelligence SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
