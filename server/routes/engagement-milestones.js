import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM engagement_milestones WHERE engagement_id = $1 ORDER BY due_date ASC NULLS LAST, created_at',
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
    const { title, description, status, due_date, draft_url } = req.body;
    if (!title) return res.status(400).json({ message: 'title required' });
    const { rows } = await pool.query(
      `INSERT INTO engagement_milestones (engagement_id, title, description, status, due_date, draft_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.engagementId, title, description || null, status || 'pending', due_date || null, draft_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, due_date, draft_url, completed_at } = req.body;
    const completedVal = status === 'completed' && !completed_at ? new Date().toISOString() : completed_at || null;
    const { rows } = await pool.query(
      `UPDATE engagement_milestones SET
        title = COALESCE($1, title), description = $2, status = COALESCE($3, status),
        due_date = $4, draft_url = $5, completed_at = $6, updated_at = NOW()
       WHERE id = $7 AND engagement_id = $8 RETURNING *`,
      [title, description, status, due_date, draft_url, completedVal, req.params.id, req.params.engagementId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Milestone not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM engagement_milestones WHERE id = $1 AND engagement_id = $2',
      [req.params.id, req.params.engagementId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Milestone not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
