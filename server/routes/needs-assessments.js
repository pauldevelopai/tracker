import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { analyseAssessment } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT na.*, o.name AS organisation_name, s.name AS sector_name, s.colour AS sector_colour,
        c.first_name AS contact_first_name, c.last_name AS contact_last_name
      FROM needs_assessments na
      LEFT JOIN organisations o ON na.organisation_id = o.id
      LEFT JOIN sectors s ON na.sector_id = s.id
      LEFT JOIN contacts c ON na.contact_id = c.id
      WHERE ($1::uuid IS NULL OR na.sector_id = $1)
    `;
    const params = [req.sectorId];

    if (status) {
      params.push(status);
      query += ` AND na.status = $${params.length}`;
    }

    query += ' ORDER BY na.created_at DESC';
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
      `SELECT na.*, o.name AS organisation_name, s.name AS sector_name, s.slug AS sector_slug, s.colour AS sector_colour,
        c.first_name AS contact_first_name, c.last_name AS contact_last_name, c.email AS contact_email
       FROM needs_assessments na
       LEFT JOIN organisations o ON na.organisation_id = o.id
       LEFT JOIN sectors s ON na.sector_id = s.id
       LEFT JOIN contacts c ON na.contact_id = c.id
       WHERE na.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Assessment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, organisation_id, contact_id } = req.body;
    if (!sector_id) {
      return res.status(400).json({ message: 'sector_id required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO needs_assessments (sector_id, organisation_id, contact_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [sector_id, organisation_id || null, contact_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sector_id, organisation_id, contact_id, status, responses, submitted_at } = req.body;
    const { rows } = await pool.query(
      `UPDATE needs_assessments SET
        sector_id = COALESCE($1, sector_id), organisation_id = $2,
        contact_id = $3, status = COALESCE($4, status),
        responses = COALESCE($5, responses),
        submitted_at = COALESCE($6, submitted_at),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [sector_id, organisation_id || null, contact_id || null, status, responses ? JSON.stringify(responses) : null, submitted_at, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Assessment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/analyse', async (req, res) => {
  try {
    // Get the assessment
    const { rows } = await pool.query(
      `SELECT na.*, s.name AS sector_name, o.name AS organisation_name
       FROM needs_assessments na
       LEFT JOIN sectors s ON na.sector_id = s.id
       LEFT JOIN organisations o ON na.organisation_id = o.id
       WHERE na.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Assessment not found' });

    const assessment = rows[0];
    if (!assessment.responses || assessment.responses.length === 0) {
      return res.status(400).json({ message: 'Assessment has no responses to analyse' });
    }

    // Call Claude API
    const { analysis, tier } = await analyseAssessment(
      assessment.sector_name,
      assessment.organisation_name,
      assessment.responses
    );

    // Update assessment
    const { rows: updated } = await pool.query(
      `UPDATE needs_assessments SET
        ai_analysis = $1, recommended_tier = $2, status = 'analysed',
        analysed_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [analysis, tier, req.params.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ message: err.message || 'Analysis failed' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM needs_assessments WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Assessment not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
