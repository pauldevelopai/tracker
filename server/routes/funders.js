import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT f.*,
        (SELECT COUNT(*) FROM funding_opportunities fo WHERE fo.funder_id = f.id) AS opportunity_count
      FROM funders f WHERE f.is_active = true
    `;
    const params = [];
    if (req.query.type) { params.push(req.query.type); query += ` AND f.type = $${params.length}`; }
    query += ' ORDER BY f.name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funders WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Funder not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, website, contact_name, contact_email, country, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'name required' });
    const { rows } = await pool.query(
      `INSERT INTO funders (name, type, website, contact_name, contact_email, country, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, type || 'foundation', website || null, contact_name || null, contact_email || null, country || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, website, contact_name, contact_email, country, notes, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE funders SET
        name = COALESCE($1, name), type = COALESCE($2, type), website = $3,
        contact_name = $4, contact_email = $5, country = $6, notes = $7,
        is_active = COALESCE($8, is_active), updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name, type, website, contact_name, contact_email, country, notes, is_active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Funder not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM funders WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Funder not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
