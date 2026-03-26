import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cp.*, c.first_name, c.last_name, c.email, o.name AS organisation_name
       FROM cohort_participants cp
       JOIN contacts c ON cp.contact_id = c.id
       LEFT JOIN organisations o ON c.organisation_id = o.id
       WHERE cp.cohort_id = $1
       ORDER BY c.last_name, c.first_name`,
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
    const { contact_id, status } = req.body;
    if (!contact_id) {
      return res.status(400).json({ message: 'contact_id required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO cohort_participants (cohort_id, contact_id, status)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.cohortId, contact_id, status || 'enrolled']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Contact already added to this cohort' });
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, completion_date, cpd_certificate_issued, feedback_score, feedback_notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE cohort_participants SET
        status = COALESCE($1, status), completion_date = $2,
        cpd_certificate_issued = COALESCE($3, cpd_certificate_issued),
        feedback_score = $4, feedback_notes = $5, updated_at = NOW()
       WHERE id = $6 AND cohort_id = $7 RETURNING *`,
      [status, completion_date || null, cpd_certificate_issued, feedback_score || null, feedback_notes || null, req.params.id, req.params.cohortId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Participant not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cohort_participants WHERE id = $1 AND cohort_id = $2',
      [req.params.id, req.params.cohortId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Participant not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
