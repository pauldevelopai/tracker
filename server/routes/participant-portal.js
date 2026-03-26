import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// Middleware: validate participant token
async function requireToken(req, res, next) {
  const token = req.query.token || req.headers['x-participant-token'];
  if (!token) return res.status(401).json({ message: 'Access token required' });

  const { rows } = await pool.query(
    `SELECT pt.*, c.first_name, c.last_name, c.email, c.job_title, c.organisation_id,
       o.name AS org_name
     FROM participant_tokens pt
     JOIN contacts c ON pt.contact_id = c.id
     LEFT JOIN organisations o ON c.organisation_id = o.id
     WHERE pt.token = $1 AND pt.is_active = true`,
    [token]
  );
  if (rows.length === 0) return res.status(401).json({ message: 'Invalid or expired token' });

  req.participant = rows[0];
  // Update last accessed
  pool.query('UPDATE participant_tokens SET last_accessed_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});
  next();
}

// Get participant profile + journey
router.get('/me', requireToken, async (req, res) => {
  try {
    const p = req.participant;
    const { rows: [journey] } = await pool.query(
      'SELECT * FROM learning_journeys WHERE contact_id = $1', [p.contact_id]
    );
    res.json({
      name: `${p.first_name} ${p.last_name}`,
      email: p.email,
      job_title: p.job_title,
      organisation: p.org_name,
      journey: journey || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get participant's tasks
router.get('/tasks', requireToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lt.*, lo.title AS outcome_title FROM learning_tasks lt
       LEFT JOIN learning_outcomes lo ON lt.outcome_id = lo.id
       WHERE lt.contact_id = $1 ORDER BY
         CASE lt.status WHEN 'assigned' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'revision_needed' THEN 3
           WHEN 'submitted' THEN 4 WHEN 'approved' THEN 5 END,
         lt.due_date NULLS LAST, lt.created_at`,
      [req.participant.contact_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit work for a task
router.post('/tasks/:id/submit', requireToken, async (req, res) => {
  try {
    const { submission_text, submission_url } = req.body;
    if (!submission_text && !submission_url) return res.status(400).json({ message: 'Submission text or URL required' });

    const { rows } = await pool.query(
      `UPDATE learning_tasks SET status = 'submitted', submission_text = $1, submission_url = $2,
       submitted_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND contact_id = $4 AND status IN ('assigned', 'in_progress', 'revision_needed')
       RETURNING *`,
      [submission_text || null, submission_url || null, req.params.id, req.participant.contact_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Task not found or already submitted' });

    // Update journey last activity
    await pool.query('UPDATE learning_journeys SET last_activity_at = NOW() WHERE contact_id = $1', [req.participant.contact_id]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get progress summary
router.get('/progress', requireToken, async (req, res) => {
  try {
    const contactId = req.participant.contact_id;
    const { rows: tasks } = await pool.query('SELECT status FROM learning_tasks WHERE contact_id = $1', [contactId]);
    const total = tasks.length;
    const approved = tasks.filter(t => t.status === 'approved').length;
    const submitted = tasks.filter(t => t.status === 'submitted').length;
    const assigned = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;
    const revision = tasks.filter(t => t.status === 'revision_needed').length;

    res.json({
      total, approved, submitted, assigned, revision_needed: revision,
      progress: total > 0 ? Math.round((approved / total) * 100) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
