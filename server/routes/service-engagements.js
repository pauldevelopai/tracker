import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import sessionRoutes from './engagement-sessions.js';
import milestoneRoutes from './engagement-milestones.js';

const router = Router();

router.use('/:engagementId/sessions', sessionRoutes);
router.use('/:engagementId/milestones', milestoneRoutes);

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT se.*, s.name AS sector_name, s.colour AS sector_colour,
        o.name AS organisation_name, c.first_name || ' ' || c.last_name AS contact_name,
        t.name AS mentor_name
      FROM service_engagements se
      LEFT JOIN sectors s ON se.sector_id = s.id
      LEFT JOIN organisations o ON se.organisation_id = o.id
      LEFT JOIN contacts c ON se.contact_id = c.id
      LEFT JOIN team_members t ON se.mentor_id = t.id
      WHERE ($1::uuid IS NULL OR se.sector_id = $1)
    `;
    const params = [req.sectorId];

    if (req.query.type) {
      params.push(req.query.type);
      query += ` AND se.type = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      query += ` AND se.status = $${params.length}`;
    }

    query += ' ORDER BY se.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT se.*, s.name AS sector_name, s.colour AS sector_colour,
        o.name AS organisation_name, c.first_name || ' ' || c.last_name AS contact_name,
        c.email AS contact_email, t.name AS mentor_name,
        na.ai_analysis AS assessment_analysis
       FROM service_engagements se
       LEFT JOIN sectors s ON se.sector_id = s.id
       LEFT JOIN organisations o ON se.organisation_id = o.id
       LEFT JOIN contacts c ON se.contact_id = c.id
       LEFT JOIN team_members t ON se.mentor_id = t.id
       LEFT JOIN needs_assessments na ON se.assessment_id = na.id
       WHERE se.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Engagement not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, organisation_id, contact_id, type, status, mentor_id, start_date, end_date, deliverable_url, document_id, assessment_id, notes } = req.body;
    if (!sector_id || !type) return res.status(400).json({ message: 'sector_id and type required' });
    const { rows } = await pool.query(
      `INSERT INTO service_engagements (sector_id, organisation_id, contact_id, type, status, mentor_id, start_date, end_date, deliverable_url, document_id, assessment_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [sector_id, organisation_id || null, contact_id || null, type, status || 'scoping', mentor_id || null, start_date || null, end_date || null, deliverable_url || null, document_id || null, assessment_id || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sector_id, organisation_id, contact_id, type, status, mentor_id, start_date, end_date, deliverable_url, document_id, assessment_id, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE service_engagements SET
        sector_id = COALESCE($1, sector_id), organisation_id = $2, contact_id = $3,
        type = COALESCE($4, type), status = COALESCE($5, status), mentor_id = $6,
        start_date = $7, end_date = $8, deliverable_url = $9, document_id = $10,
        assessment_id = $11, notes = $12, updated_at = NOW()
       WHERE id = $13 RETURNING *`,
      [sector_id, organisation_id, contact_id, type, status, mentor_id, start_date, end_date, deliverable_url, document_id, assessment_id, notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Engagement not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM service_engagements WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Engagement not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
