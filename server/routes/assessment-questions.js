import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { sector_id } = req.query;
    if (!sector_id) {
      return res.status(400).json({ message: 'sector_id query parameter required' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM assessment_questions WHERE sector_id = $1 AND is_active = true ORDER BY order_index',
      [sector_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const { sector_id } = req.query;
    if (!sector_id) {
      return res.status(400).json({ message: 'sector_id query parameter required' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM assessment_questions WHERE sector_id = $1 ORDER BY order_index',
      [sector_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { sector_id, question_text, question_type, options, order_index } = req.body;
    if (!sector_id || !question_text) {
      return res.status(400).json({ message: 'sector_id and question_text required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO assessment_questions (sector_id, question_text, question_type, options, order_index)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [sector_id, question_text, question_type || 'text', options ? JSON.stringify(options) : null, order_index || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { question_text, question_type, options, order_index, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE assessment_questions SET
        question_text = COALESCE($1, question_text), question_type = COALESCE($2, question_type),
        options = $3, order_index = COALESCE($4, order_index),
        is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [question_text, question_type, options ? JSON.stringify(options) : null, order_index, is_active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Question not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE assessment_questions SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Question not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
