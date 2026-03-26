import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sectors ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sectors WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Sector not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, slug, description, colour, is_active } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Name and slug required' });
    const { rows } = await pool.query(
      `INSERT INTO sectors (name, slug, description, colour, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, slug, description || null, colour || '#6B7280', is_active !== false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Slug already exists' });
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, slug, description, colour, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE sectors SET name = COALESCE($1, name), slug = COALESCE($2, slug),
       description = COALESCE($3, description), colour = COALESCE($4, colour),
       is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, slug, description, colour, is_active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Sector not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE sectors SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Sector not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
