import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { researchFundingOpportunity } from '../services/claude.js';
import applicationRoutes from './funding-applications.js';

const router = Router();

router.use('/:opportunityId/applications', applicationRoutes);

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT fo.*, f.name AS funder_name, f.type AS funder_type,
        s.name AS sector_name, s.colour AS sector_colour,
        (SELECT COUNT(*) FROM funding_applications fa WHERE fa.opportunity_id = fo.id) AS application_count
      FROM funding_opportunities fo
      LEFT JOIN funders f ON fo.funder_id = f.id
      LEFT JOIN sectors s ON fo.sector_id = s.id
      WHERE ($1::uuid IS NULL OR fo.sector_id = $1)
    `;
    const params = [req.sectorId];
    if (req.query.pipeline_stage) { params.push(req.query.pipeline_stage); query += ` AND fo.pipeline_stage = $${params.length}`; }
    if (req.query.status) { params.push(req.query.status); query += ` AND fo.status = $${params.length}`; }
    if (req.query.priority) { params.push(req.query.priority); query += ` AND fo.priority = $${params.length}`; }
    query += ' ORDER BY fo.deadline ASC NULLS LAST, fo.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/pipeline-stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE pipeline_stage NOT IN ('won','lost')) AS active_count,
        COALESCE(SUM(amount_max) FILTER (WHERE pipeline_stage NOT IN ('won','lost')), 0) AS pipeline_value,
        COALESCE(SUM(fa.amount_awarded), 0) AS won_total,
        COUNT(*) FILTER (WHERE pipeline_stage = 'decision') AS pending_decisions,
        COUNT(*) FILTER (WHERE deadline IS NOT NULL AND deadline > NOW() AND deadline < NOW() + INTERVAL '30 days') AS upcoming_deadlines
      FROM funding_opportunities fo
      LEFT JOIN funding_applications fa ON fa.opportunity_id = fo.id AND fa.status = 'awarded'
      WHERE ($1::uuid IS NULL OR fo.sector_id = $1)
    `, [req.sectorId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fo.*, f.name AS funder_name, f.type AS funder_type, f.website AS funder_website,
        s.name AS sector_name, s.colour AS sector_colour
       FROM funding_opportunities fo
       LEFT JOIN funders f ON fo.funder_id = f.id
       LEFT JOIN sectors s ON fo.sector_id = s.id
       WHERE fo.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Opportunity not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { funder_id, sector_id, title, description, amount_min, amount_max, currency, deadline, status, pipeline_stage, priority, match_funding_required, match_funding_amount, eligibility_notes, url } = req.body;
    if (!title) return res.status(400).json({ message: 'title required' });
    const { rows } = await pool.query(
      `INSERT INTO funding_opportunities (funder_id, sector_id, title, description, amount_min, amount_max, currency, deadline, status, pipeline_stage, priority, match_funding_required, match_funding_amount, eligibility_notes, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [funder_id || null, sector_id || null, title, description || null, amount_min || null, amount_max || null, currency || 'GBP', deadline || null, status || 'researching', pipeline_stage || 'identified', priority || 'medium', match_funding_required || false, match_funding_amount || null, eligibility_notes || null, url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { funder_id, sector_id, title, description, amount_min, amount_max, currency, deadline, status, pipeline_stage, priority, match_funding_required, match_funding_amount, eligibility_notes, ai_research_notes, url } = req.body;
    const { rows } = await pool.query(
      `UPDATE funding_opportunities SET
        funder_id = $1, sector_id = $2, title = COALESCE($3, title), description = $4,
        amount_min = $5, amount_max = $6, currency = COALESCE($7, currency),
        deadline = $8, status = COALESCE($9, status), pipeline_stage = COALESCE($10, pipeline_stage),
        priority = COALESCE($11, priority), match_funding_required = COALESCE($12, match_funding_required),
        match_funding_amount = $13, eligibility_notes = $14, ai_research_notes = $15, url = $16, updated_at = NOW()
       WHERE id = $17 RETURNING *`,
      [funder_id, sector_id, title, description, amount_min, amount_max, currency, deadline, status, pipeline_stage, priority, match_funding_required, match_funding_amount, eligibility_notes, ai_research_notes, url, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Opportunity not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/ai-research', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fo.*, f.name AS funder_name, s.name AS sector_name
       FROM funding_opportunities fo
       LEFT JOIN funders f ON fo.funder_id = f.id
       LEFT JOIN sectors s ON fo.sector_id = s.id
       WHERE fo.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Opportunity not found' });
    const opp = rows[0];

    const research = await researchFundingOpportunity(opp.funder_name, opp.title, opp.url, opp.sector_name);

    await pool.query('UPDATE funding_opportunities SET ai_research_notes = $1, updated_at = NOW() WHERE id = $2', [research, req.params.id]);
    res.json({ research });
  } catch (err) {
    console.error('AI research error:', err);
    res.status(500).json({ message: err.message || 'AI research failed' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM funding_opportunities WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Opportunity not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
