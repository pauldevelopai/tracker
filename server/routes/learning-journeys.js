import { Router } from 'express';
import pool from '../db/pool.js';
import { assessLearningProgress } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { organisation_id, status } = req.query;
    let query = `
      SELECT lj.*, c.first_name, c.last_name, c.job_title, c.email, o.name AS org_name,
        (SELECT count(*)::int FROM learning_tasks lt WHERE lt.contact_id = lj.contact_id) AS total_tasks,
        (SELECT count(*)::int FROM learning_tasks lt WHERE lt.contact_id = lj.contact_id AND lt.status = 'approved') AS completed_tasks,
        (SELECT count(*)::int FROM learning_tasks lt WHERE lt.contact_id = lj.contact_id AND lt.status = 'submitted') AS pending_review
      FROM learning_journeys lj
      LEFT JOIN contacts c ON lj.contact_id = c.id
      LEFT JOIN organisations o ON lj.organisation_id = o.id
      WHERE ($1::uuid IS NULL OR lj.sector_id = $1)
    `;
    const params = [req.sectorId];
    if (organisation_id) { params.push(organisation_id); query += ` AND lj.organisation_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND lj.status = $${params.length}`; }
    query += ' ORDER BY lj.last_activity_at DESC NULLS LAST';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const sid = req.sectorId;
    const [journeys, totalTasks, pendingReview, stalledLearners] = await Promise.all([
      pool.query("SELECT count(*)::int as c FROM learning_journeys WHERE status = 'active' AND ($1::uuid IS NULL OR sector_id = $1)", [sid]),
      pool.query("SELECT count(*)::int as c FROM learning_tasks"),
      pool.query("SELECT count(*)::int as c FROM learning_tasks WHERE status = 'submitted'"),
      pool.query("SELECT count(*)::int as c FROM learning_journeys WHERE status = 'active' AND (last_activity_at IS NULL OR last_activity_at < NOW() - INTERVAL '7 days') AND ($1::uuid IS NULL OR sector_id = $1)", [sid]),
    ]);
    res.json({
      active_learners: journeys.rows[0].c,
      pending_reviews: pendingReview.rows[0].c,
      stalled_learners: stalledLearners.rows[0].c,
      total_tasks: totalTasks.rows[0].c,
      // Keep old names for backward compat
      activeJourneys: journeys.rows[0].c,
      pendingReview: pendingReview.rows[0].c,
      totalTasks: totalTasks.rows[0].c,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/contact/:contactId', async (req, res) => {
  try {
    const { rows: [journey] } = await pool.query(
      `SELECT lj.*, c.first_name, c.last_name, c.job_title, c.email, o.name AS org_name
       FROM learning_journeys lj
       LEFT JOIN contacts c ON lj.contact_id = c.id
       LEFT JOIN organisations o ON lj.organisation_id = o.id
       WHERE lj.contact_id = $1`, [req.params.contactId]
    );
    if (!journey) return res.status(404).json({ message: 'No journey found for this contact' });

    const { rows: tasks } = await pool.query(
      `SELECT lt.*, lo.title AS outcome_title FROM learning_tasks lt
       LEFT JOIN learning_outcomes lo ON lt.outcome_id = lo.id
       WHERE lt.contact_id = $1 ORDER BY lt.created_at`, [req.params.contactId]
    );

    res.json({ ...journey, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [journey] } = await pool.query(
      `SELECT lj.*, c.first_name, c.last_name, c.job_title, c.email, o.name AS org_name
       FROM learning_journeys lj
       LEFT JOIN contacts c ON lj.contact_id = c.id
       LEFT JOIN organisations o ON lj.organisation_id = o.id
       WHERE lj.id = $1`, [req.params.id]
    );
    if (!journey) return res.status(404).json({ message: 'Journey not found' });

    const { rows: tasks } = await pool.query(
      `SELECT lt.*, lo.title AS outcome_title FROM learning_tasks lt
       LEFT JOIN learning_outcomes lo ON lt.outcome_id = lo.id
       WHERE lt.contact_id = $1 ORDER BY lt.created_at`, [journey.contact_id]
    );

    res.json({ ...journey, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { contact_id, organisation_id, sector_id, skill_level } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });
    const { rows } = await pool.query(
      `INSERT INTO learning_journeys (contact_id, organisation_id, sector_id, skill_level)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [contact_id, organisation_id || null, sector_id || null, skill_level || 'beginner']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, skill_level, ai_notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE learning_journeys SET status = COALESCE($1, status), skill_level = COALESCE($2, skill_level),
       ai_notes = COALESCE($3, ai_notes), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [status, skill_level, ai_notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI assess progress
router.post('/:id/ai-assess', async (req, res) => {
  try {
    const { rows: [journey] } = await pool.query(
      `SELECT lj.*, c.first_name, c.last_name, c.job_title, o.name AS org_name
       FROM learning_journeys lj LEFT JOIN contacts c ON lj.contact_id = c.id
       LEFT JOIN organisations o ON lj.organisation_id = o.id WHERE lj.id = $1`, [req.params.id]
    );
    if (!journey) return res.status(404).json({ message: 'Not found' });

    const { rows: tasks } = await pool.query('SELECT * FROM learning_tasks WHERE contact_id = $1', [journey.contact_id]);
    const { rows: outcomes } = await pool.query(
      `SELECT DISTINCT lo.* FROM learning_outcomes lo
       JOIN learning_tasks lt ON lt.outcome_id = lo.id WHERE lt.contact_id = $1`, [journey.contact_id]
    );

    const contact = { first_name: journey.first_name, last_name: journey.last_name, job_title: journey.job_title };
    const org = { name: journey.org_name };
    const assessment = await assessLearningProgress(contact, org, journey, tasks, outcomes);

    await pool.query('UPDATE learning_journeys SET ai_notes = $1, updated_at = NOW() WHERE id = $2', [assessment, req.params.id]);

    res.json({ assessment });
  } catch (err) {
    console.error('AI assessment error:', err);
    res.status(500).json({ message: err.message || 'Assessment failed' });
  }
});

export default router;
