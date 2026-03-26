import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import participantRoutes from './cohort-participants.js';
import sessionRoutes from './cohort-sessions.js';

const router = Router();

// Nest sub-routes
router.use('/:cohortId/participants', participantRoutes);
router.use('/:cohortId/sessions', sessionRoutes);

router.get('/', async (req, res) => {
  try {
    const { status, client_id } = req.query;
    let query = `
      SELECT c.*, co.name AS client_name, s.name AS sector_name, s.colour AS sector_colour,
        t.name AS trainer_name,
        (SELECT COUNT(*) FROM cohort_participants cp WHERE cp.cohort_id = c.id) AS participant_count,
        (SELECT COUNT(*) FROM cohort_organisations corg WHERE corg.cohort_id = c.id) AS org_count
      FROM cohorts c
      LEFT JOIN organisations co ON c.client_organisation_id = co.id
      LEFT JOIN sectors s ON c.sector_id = s.id
      LEFT JOIN team_members t ON c.trainer_id = t.id
      WHERE ($1::uuid IS NULL OR c.sector_id = $1)
    `;
    const params = [req.sectorId];

    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    if (client_id) {
      params.push(client_id);
      query += ` AND c.client_organisation_id = $${params.length}`;
    }

    query += ' ORDER BY c.start_date DESC NULLS LAST, c.name';
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
      `SELECT c.*, co.name AS client_name, s.name AS sector_name, s.colour AS sector_colour,
        t.name AS trainer_name
       FROM cohorts c
       LEFT JOIN organisations co ON c.client_organisation_id = co.id
       LEFT JOIN sectors s ON c.sector_id = s.id
       LEFT JOIN team_members t ON c.trainer_id = t.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Cohort not found' });

    // Get organisations in this cohort
    const { rows: orgs } = await pool.query(
      `SELECT corg.id AS link_id, o.id, o.name, o.type, o.country
       FROM cohort_organisations corg
       JOIN organisations o ON corg.organisation_id = o.id
       WHERE corg.cohort_id = $1 ORDER BY o.name`,
      [req.params.id]
    );

    res.json({ ...rows[0], organisations: orgs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, client_organisation_id, name, delivery_type, status, start_date, end_date, trainer_id, max_participants, cpd_hours, notes, organisation_ids } = req.body;
    if (!sector_id || !name) {
      return res.status(400).json({ message: 'sector_id and name required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO cohorts (sector_id, client_organisation_id, name, delivery_type, status, start_date, end_date, trainer_id, max_participants, cpd_hours, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [sector_id, client_organisation_id || null, name, delivery_type || 'online_3x2hr', status || 'planned', start_date || null, end_date || null, trainer_id || null, max_participants || null, cpd_hours || null, notes || null]
    );

    // Add organisations if provided
    if (organisation_ids && Array.isArray(organisation_ids)) {
      for (const orgId of organisation_ids) {
        await pool.query('INSERT INTO cohort_organisations (cohort_id, organisation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [rows[0].id, orgId]);
      }
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sector_id, client_organisation_id, name, delivery_type, status, start_date, end_date, trainer_id, max_participants, cpd_hours, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE cohorts SET
        sector_id = COALESCE($1, sector_id), client_organisation_id = $2,
        name = COALESCE($3, name), delivery_type = COALESCE($4, delivery_type),
        status = COALESCE($5, status), start_date = $6, end_date = $7,
        trainer_id = $8, max_participants = $9, cpd_hours = $10,
        notes = $11, updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [sector_id, client_organisation_id || null, name, delivery_type, status, start_date || null, end_date || null, trainer_id || null, max_participants || null, cpd_hours || null, notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Cohort not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add org to cohort
router.post('/:id/organisations', async (req, res) => {
  try {
    const { organisation_id } = req.body;
    if (!organisation_id) return res.status(400).json({ message: 'organisation_id required' });
    await pool.query('INSERT INTO cohort_organisations (cohort_id, organisation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, organisation_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove org from cohort
router.delete('/:id/organisations/:orgId', async (req, res) => {
  try {
    await pool.query('DELETE FROM cohort_organisations WHERE cohort_id = $1 AND organisation_id = $2', [req.params.id, req.params.orgId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cohorts WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Cohort not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
