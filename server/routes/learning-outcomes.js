import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { course_id } = req.query;
    let query = 'SELECT * FROM learning_outcomes WHERE 1=1';
    const params = [];
    if (course_id) { params.push(course_id); query += ` AND course_id = $${params.length}`; }
    query += ' ORDER BY order_index';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { course_id, module_id, title, description, assessment_criteria, order_index } = req.body;
    if (!title) return res.status(400).json({ message: 'title required' });
    const { rows } = await pool.query(
      `INSERT INTO learning_outcomes (course_id, module_id, title, description, assessment_criteria, order_index)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [course_id || null, module_id || null, title, description || null, assessment_criteria || null, order_index || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, assessment_criteria, order_index } = req.body;
    const { rows } = await pool.query(
      `UPDATE learning_outcomes SET title = COALESCE($1, title), description = $2,
       assessment_criteria = $3, order_index = COALESCE($4, order_index), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, description, assessment_criteria, order_index, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM learning_outcomes WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
