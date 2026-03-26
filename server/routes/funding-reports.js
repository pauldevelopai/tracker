import { Router } from 'express';
import pool from '../db/pool.js';
import { draftFundingReport } from '../services/claude.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM funding_reports WHERE application_id = $1 ORDER BY due_date ASC NULLS LAST',
      [req.params.applicationId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, type, status, due_date } = req.body;
    if (!title) return res.status(400).json({ message: 'title required' });
    const { rows } = await pool.query(
      `INSERT INTO funding_reports (application_id, title, type, status, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.applicationId, title, type || 'interim', status || 'pending', due_date || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, type, status, due_date, submitted_at, content } = req.body;
    const { rows } = await pool.query(
      `UPDATE funding_reports SET
        title = COALESCE($1, title), type = COALESCE($2, type), status = COALESCE($3, status),
        due_date = $4, submitted_at = $5, content = $6, updated_at = NOW()
       WHERE id = $7 AND application_id = $8 RETURNING *`,
      [title, type, status, due_date, submitted_at, content, req.params.id, req.params.applicationId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Report not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/ai-draft', async (req, res) => {
  try {
    const { rows: reportRows } = await pool.query('SELECT * FROM funding_reports WHERE id = $1', [req.params.id]);
    if (reportRows.length === 0) return res.status(404).json({ message: 'Report not found' });
    const report = reportRows[0];

    // Get application and opportunity context
    const { rows: appRows } = await pool.query(
      `SELECT fa.*, fo.title AS opp_title, fo.description AS opp_description, f.name AS funder_name, s.name AS sector_name
       FROM funding_applications fa
       LEFT JOIN funding_opportunities fo ON fa.opportunity_id = fo.id
       LEFT JOIN funders f ON fo.funder_id = f.id
       LEFT JOIN sectors s ON fo.sector_id = s.id
       WHERE fa.id = $1`,
      [req.params.applicationId]
    );
    const app = appRows[0] || {};

    // Get programme stats
    const { rows: stats } = await pool.query(`
      SELECT COUNT(DISTINCT c.id) AS cohort_count, COUNT(DISTINCT cp.id) AS participant_count,
        ROUND(AVG(cp.feedback_score), 1) AS avg_feedback
      FROM cohorts c LEFT JOIN cohort_participants cp ON cp.cohort_id = c.id
    `);

    const content = await draftFundingReport(
      report.type,
      `Funder: ${app.funder_name || 'N/A'}\nProject: ${app.title || app.opp_title || 'N/A'}\nAmount awarded: ${app.amount_awarded || 'N/A'}`,
      { cohortCount: stats[0]?.cohort_count, participantCount: stats[0]?.participant_count, avgFeedback: stats[0]?.avg_feedback },
      app.sector_name
    );

    const { rows: updated } = await pool.query(
      'UPDATE funding_reports SET content = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [content, 'drafting', req.params.id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('Report AI draft error:', err);
    res.status(500).json({ message: err.message || 'AI draft failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM funding_reports WHERE id = $1 AND application_id = $2',
      [req.params.id, req.params.applicationId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Report not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
