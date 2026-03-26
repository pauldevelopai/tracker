import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { sector_id, type } = req.query;
    let query = 'SELECT * FROM document_templates WHERE is_active = true';
    const params = [];
    if (sector_id) { params.push(sector_id); query += ` AND sector_id = $${params.length}`; }
    if (type) { params.push(type); query += ` AND type = $${params.length}`; }
    query += ' ORDER BY type, title';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT dt.*, s.name AS sector_name FROM document_templates dt
       LEFT JOIN sectors s ON dt.sector_id = s.id ORDER BY dt.type, dt.title`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM document_templates WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Template not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { sector_id, type, title, description, template_prompt, structure } = req.body;
    if (!sector_id || !type || !title || !template_prompt) {
      return res.status(400).json({ message: 'sector_id, type, title, and template_prompt required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO document_templates (sector_id, type, title, description, template_prompt, structure)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sector_id, type, title, description || null, template_prompt, structure ? JSON.stringify(structure) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { title, description, template_prompt, structure, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE document_templates SET
        title = COALESCE($1, title), description = $2,
        template_prompt = COALESCE($3, template_prompt),
        structure = $4, is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title, description, template_prompt, structure ? JSON.stringify(structure) : null, is_active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Template not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
