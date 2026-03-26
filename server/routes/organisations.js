import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { search, relationship_stage } = req.query;
    let query = `
      SELECT o.*, s.name AS sector_name, s.colour AS sector_colour,
        (SELECT COUNT(*) FROM contacts c WHERE c.organisation_id = o.id) AS contact_count
      FROM organisations o
      LEFT JOIN sectors s ON o.sector_id = s.id
      WHERE ($1::uuid IS NULL OR o.sector_id = $1)
    `;
    const params = [req.sectorId];

    if (relationship_stage) {
      params.push(relationship_stage);
      query += ` AND o.relationship_stage = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND o.name ILIKE $${params.length}`;
    }
    if (req.query.funder_id) {
      params.push(req.query.funder_id);
      query += ` AND o.funder_organisation_id = $${params.length}`;
    }
    if (req.query.relationship_type) {
      params.push(req.query.relationship_type);
      query += ` AND o.relationship_type = $${params.length}`;
    }

    query += ' ORDER BY o.name';
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
      `SELECT o.*, s.name AS sector_name, s.colour AS sector_colour
       FROM organisations o
       LEFT JOIN sectors s ON o.sector_id = s.id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Organisation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, name, type, country, city, website, notes, relationship_stage } = req.body;
    if (!sector_id || !name) {
      return res.status(400).json({ message: 'sector_id and name required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO organisations (sector_id, name, type, country, city, website, notes, relationship_stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sector_id, name, type || null, country || null, city || null, website || null, notes || null, relationship_stage || 'prospect']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sector_id, name, type, country, city, website, notes, relationship_stage } = req.body;
    const { rows } = await pool.query(
      `UPDATE organisations SET
        sector_id = COALESCE($1, sector_id), name = COALESCE($2, name),
        type = $3, country = $4, city = $5, website = $6,
        notes = $7, relationship_stage = COALESCE($8, relationship_stage),
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [sector_id, name, type, country, city, website, notes, relationship_stage, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Organisation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM organisations WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Organisation not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
