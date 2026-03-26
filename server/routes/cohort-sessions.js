import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM cohort_sessions WHERE cohort_id = $1 ORDER BY order_index, session_date',
      [req.params.cohortId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, session_date, start_time, end_time, location, notes, order_index } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'title required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO cohort_sessions (cohort_id, title, session_date, start_time, end_time, location, notes, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.cohortId, title, session_date || null, start_time || null, end_time || null, location || null, notes || null, order_index || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, session_date, start_time, end_time, location, notes, order_index } = req.body;
    const { rows } = await pool.query(
      `UPDATE cohort_sessions SET
        title = COALESCE($1, title), session_date = $2,
        start_time = $3, end_time = $4, location = $5,
        notes = $6, order_index = COALESCE($7, order_index), updated_at = NOW()
       WHERE id = $8 AND cohort_id = $9 RETURNING *`,
      [title, session_date || null, start_time || null, end_time || null, location || null, notes || null, order_index, req.params.id, req.params.cohortId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Session not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cohort_sessions WHERE id = $1 AND cohort_id = $2',
      [req.params.id, req.params.cohortId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Session not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
