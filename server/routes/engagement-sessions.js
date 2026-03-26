import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM engagement_sessions WHERE engagement_id = $1 ORDER BY session_date DESC, created_at DESC',
      [req.params.engagementId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { session_date, duration_minutes, notes, next_steps } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO engagement_sessions (engagement_id, session_date, duration_minutes, notes, next_steps)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.engagementId, session_date || null, duration_minutes || null, notes || null, next_steps || null]
    );
    // Update session count on engagement
    await pool.query(
      `UPDATE service_engagements SET session_count = (
        SELECT COUNT(*) FROM engagement_sessions WHERE engagement_id = $1
      ), updated_at = NOW() WHERE id = $1`,
      [req.params.engagementId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { session_date, duration_minutes, notes, next_steps } = req.body;
    const { rows } = await pool.query(
      `UPDATE engagement_sessions SET
        session_date = $1, duration_minutes = $2, notes = $3, next_steps = $4, updated_at = NOW()
       WHERE id = $5 AND engagement_id = $6 RETURNING *`,
      [session_date, duration_minutes, notes, next_steps, req.params.id, req.params.engagementId]
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
      'DELETE FROM engagement_sessions WHERE id = $1 AND engagement_id = $2',
      [req.params.id, req.params.engagementId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Session not found' });
    // Update session count
    await pool.query(
      `UPDATE service_engagements SET session_count = (
        SELECT COUNT(*) FROM engagement_sessions WHERE engagement_id = $1
      ), updated_at = NOW() WHERE id = $1`,
      [req.params.engagementId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
