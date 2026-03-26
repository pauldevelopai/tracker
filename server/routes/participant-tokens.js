import { Router } from 'express';
import pool from '../db/pool.js';
import crypto from 'crypto';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pt.*, c.first_name, c.last_name, c.email, o.name AS org_name
       FROM participant_tokens pt
       JOIN contacts c ON pt.contact_id = c.id
       LEFT JOIN organisations o ON c.organisation_id = o.id
       ORDER BY pt.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { contact_id } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });

    // Check contact exists
    const { rows: [contact] } = await pool.query('SELECT id, email FROM contacts WHERE id = $1', [contact_id]);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Check if token already exists for this contact
    const { rows: existing } = await pool.query('SELECT id FROM participant_tokens WHERE contact_id = $1 AND is_active = true', [contact_id]);
    if (existing.length > 0) {
      // Update existing token
      const { rows } = await pool.query(
        'UPDATE participant_tokens SET token = $1, is_active = true WHERE contact_id = $2 AND is_active = true RETURNING *',
        [token, contact_id]
      );
      return res.json({ ...rows[0], portal_url: `/portal?token=${token}` });
    }

    const { rows } = await pool.query(
      'INSERT INTO participant_tokens (contact_id, token, email) VALUES ($1, $2, $3) RETURNING *',
      [contact_id, token, contact.email]
    );

    res.status(201).json({ ...rows[0], portal_url: `/portal?token=${token}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE participant_tokens SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
