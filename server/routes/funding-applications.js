import { Router } from 'express';
import pool from '../db/pool.js';
import { draftFundingApplication } from '../services/claude.js';
import reportRoutes from './funding-reports.js';

const router = Router({ mergeParams: true });

router.use('/:applicationId/reports', reportRoutes);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*, t.name AS assigned_to_name
       FROM funding_applications fa
       LEFT JOIN team_members t ON fa.assigned_to = t.id
       WHERE fa.opportunity_id = $1 ORDER BY fa.created_at DESC`,
      [req.params.opportunityId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*, t.name AS assigned_to_name
       FROM funding_applications fa LEFT JOIN team_members t ON fa.assigned_to = t.id
       WHERE fa.id = $1 AND fa.opportunity_id = $2`,
      [req.params.id, req.params.opportunityId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Application not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, status, amount_requested, content, budget_breakdown, assigned_to, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO funding_applications (opportunity_id, title, status, amount_requested, content, budget_breakdown, assigned_to, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.opportunityId, title || null, status || 'drafting', amount_requested || null, content || null,
       budget_breakdown ? JSON.stringify(budget_breakdown) : '[]', assigned_to || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, status, submitted_at, decision_at, amount_requested, amount_awarded, content, budget_breakdown, assigned_to, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE funding_applications SET
        title = COALESCE($1, title), status = COALESCE($2, status), submitted_at = $3,
        decision_at = $4, amount_requested = $5, amount_awarded = $6,
        content = COALESCE($7, content), budget_breakdown = COALESCE($8, budget_breakdown),
        assigned_to = $9, notes = $10, updated_at = NOW()
       WHERE id = $11 AND opportunity_id = $12 RETURNING *`,
      [title, status, submitted_at, decision_at, amount_requested, amount_awarded, content,
       budget_breakdown ? JSON.stringify(budget_breakdown) : null, assigned_to, notes, req.params.id, req.params.opportunityId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Application not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/ai-draft', async (req, res) => {
  try {
    // Get application + opportunity context
    const { rows: appRows } = await pool.query(
      `SELECT fa.*, fo.title AS opp_title, fo.description AS opp_description, fo.eligibility_notes,
        fo.amount_min, fo.amount_max, f.name AS funder_name, s.name AS sector_name
       FROM funding_applications fa
       LEFT JOIN funding_opportunities fo ON fa.opportunity_id = fo.id
       LEFT JOIN funders f ON fo.funder_id = f.id
       LEFT JOIN sectors s ON fo.sector_id = s.id
       WHERE fa.id = $1`,
      [req.params.id]
    );
    if (appRows.length === 0) return res.status(404).json({ message: 'Application not found' });
    const app = appRows[0];

    // Get programme stats for evidence
    const { rows: stats } = await pool.query(`
      SELECT COUNT(DISTINCT c.id) AS cohort_count, COUNT(DISTINCT cp.id) AS participant_count
      FROM cohorts c LEFT JOIN cohort_participants cp ON cp.cohort_id = c.id
    `);

    const context = `Funder: ${app.funder_name || 'Unknown'}\nOpportunity: ${app.opp_title}\nDescription: ${app.opp_description || 'N/A'}\nEligibility: ${app.eligibility_notes || 'N/A'}\nFunding range: ${app.amount_min || '?'} - ${app.amount_max || '?'} ${app.currency || 'GBP'}\nAmount requested: ${app.amount_requested || 'TBD'}`;

    const content = await draftFundingApplication(
      context,
      { cohortCount: stats[0]?.cohort_count, participantCount: stats[0]?.participant_count, sectors: app.sector_name || 'Media, Legal' },
      app.sector_name
    );

    const { rows: updated } = await pool.query(
      'UPDATE funding_applications SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [content, req.params.id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('Application AI draft error:', err);
    res.status(500).json({ message: err.message || 'AI draft failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM funding_applications WHERE id = $1 AND opportunity_id = $2',
      [req.params.id, req.params.opportunityId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Application not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
