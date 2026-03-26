import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT oc.*, s.name AS sector_name, s.colour AS sector_colour,
        (SELECT COUNT(*) FROM outreach_messages om WHERE om.campaign_id = oc.id) AS message_count,
        (SELECT COUNT(*) FROM outreach_messages om WHERE om.campaign_id = oc.id AND om.status = 'sent') AS sent_count,
        (SELECT COUNT(*) FROM outreach_messages om WHERE om.campaign_id = oc.id AND om.status = 'replied') AS reply_count
      FROM outreach_campaigns oc
      LEFT JOIN sectors s ON oc.sector_id = s.id
      WHERE ($1::uuid IS NULL OR oc.sector_id = $1)
    `;
    const params = [req.sectorId];
    if (req.query.status) { params.push(req.query.status); query += ` AND oc.status = $${params.length}`; }
    query += ' ORDER BY oc.created_at DESC';
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
      `SELECT oc.*, s.name AS sector_name, s.colour AS sector_colour
       FROM outreach_campaigns oc
       LEFT JOIN sectors s ON oc.sector_id = s.id
       WHERE oc.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Campaign not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, name, type, status, target_audience, start_date, end_date, notes } = req.body;
    if (!sector_id || !name) return res.status(400).json({ message: 'sector_id and name required' });
    const { rows } = await pool.query(
      `INSERT INTO outreach_campaigns (sector_id, name, type, status, target_audience, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sector_id, name, type || 'cold_email', status || 'draft', target_audience || null, start_date || null, end_date || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sector_id, name, type, status, target_audience, start_date, end_date, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE outreach_campaigns SET
        sector_id = COALESCE($1, sector_id), name = COALESCE($2, name),
        type = COALESCE($3, type), status = COALESCE($4, status),
        target_audience = $5, start_date = $6, end_date = $7, notes = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [sector_id, name, type, status, target_audience, start_date, end_date, notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Campaign not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM outreach_campaigns WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
