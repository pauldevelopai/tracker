import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM course_modules WHERE course_id = $1 ORDER BY order_index',
      [req.params.courseId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, order_index, duration_minutes, content, content_url, video_url, feedback_notes, effectiveness_rating } = req.body;
    if (!title) return res.status(400).json({ message: 'title required' });
    const { rows } = await pool.query(
      `INSERT INTO course_modules (course_id, title, description, order_index, duration_minutes, content, content_url, video_url, feedback_notes, effectiveness_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.params.courseId, title, description || null, order_index || 0, duration_minutes || null, content || null, content_url || null, video_url || null, feedback_notes || null, effectiveness_rating || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, order_index, duration_minutes, content, content_url, video_url, feedback_notes, effectiveness_rating } = req.body;
    const { rows } = await pool.query(
      `UPDATE course_modules SET
        title = COALESCE($1, title), description = $2, order_index = COALESCE($3, order_index),
        duration_minutes = $4, content = $5, content_url = $6, video_url = $7,
        feedback_notes = $8, effectiveness_rating = $9, updated_at = NOW()
       WHERE id = $10 AND course_id = $11 RETURNING *`,
      [title, description, order_index, duration_minutes, content, content_url, video_url, feedback_notes, effectiveness_rating, req.params.id, req.params.courseId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Module not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM course_modules WHERE id = $1 AND course_id = $2',
      [req.params.id, req.params.courseId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Module not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
