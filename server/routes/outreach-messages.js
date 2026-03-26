import { Router } from 'express';
import pool from '../db/pool.js';
import { draftColdEmail } from '../services/claude.js';
import { sendEmail } from '../services/gmail.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT om.*, c.first_name, c.last_name, c.email AS contact_email, c.job_title,
        o.name AS organisation_name, oc.name AS campaign_name
      FROM outreach_messages om
      LEFT JOIN contacts c ON om.contact_id = c.id
      LEFT JOIN organisations o ON c.organisation_id = o.id
      LEFT JOIN outreach_campaigns oc ON om.campaign_id = oc.id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.campaign_id) { params.push(req.query.campaign_id); query += ` AND om.campaign_id = $${params.length}`; }
    if (req.query.status) { params.push(req.query.status); query += ` AND om.status = $${params.length}`; }
    query += ' ORDER BY om.created_at DESC';
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
      `SELECT om.*, c.first_name, c.last_name, c.email AS contact_email, c.job_title,
        o.name AS organisation_name
       FROM outreach_messages om
       LEFT JOIN contacts c ON om.contact_id = c.id
       LEFT JOIN organisations o ON c.organisation_id = o.id
       WHERE om.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Message not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { campaign_id, contact_id, channel, subject, body, status, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO outreach_messages (campaign_id, contact_id, channel, subject, body, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [campaign_id || null, contact_id || null, channel || 'email', subject || null, body || null, status || 'draft', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { subject, body, status, notes, replied_at } = req.body;
    const { rows } = await pool.query(
      `UPDATE outreach_messages SET
        subject = COALESCE($1, subject), body = COALESCE($2, body),
        status = COALESCE($3, status), notes = $4, replied_at = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [subject, body, status, notes, replied_at, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Message not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI draft endpoint
router.post('/ai-draft', async (req, res) => {
  try {
    const { contact_id, campaign_id } = req.body;
    let contactName = '', contactRole = '', orgName = '', sectorName = '', campaignGoal = '';

    if (contact_id) {
      const { rows } = await pool.query(
        `SELECT c.first_name, c.last_name, c.job_title, o.name AS org_name, s.name AS sector_name
         FROM contacts c
         LEFT JOIN organisations o ON c.organisation_id = o.id
         LEFT JOIN sectors s ON c.sector_id = s.id
         WHERE c.id = $1`, [contact_id]
      );
      if (rows[0]) {
        contactName = `${rows[0].first_name} ${rows[0].last_name}`;
        contactRole = rows[0].job_title || '';
        orgName = rows[0].org_name || '';
        sectorName = rows[0].sector_name || '';
      }
    }

    if (campaign_id) {
      const { rows } = await pool.query(
        `SELECT oc.target_audience, s.name AS sector_name FROM outreach_campaigns oc
         LEFT JOIN sectors s ON oc.sector_id = s.id WHERE oc.id = $1`, [campaign_id]
      );
      if (rows[0]) {
        campaignGoal = rows[0].target_audience || '';
        if (!sectorName) sectorName = rows[0].sector_name || '';
      }
    }

    const draft = await draftColdEmail(contactName, contactRole, orgName, sectorName || 'general', campaignGoal);
    res.json(draft);
  } catch (err) {
    console.error('AI draft error:', err);
    res.status(500).json({ message: err.message || 'AI draft failed' });
  }
});

// Send via Gmail
router.post('/:id/send', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT om.*, c.email AS contact_email FROM outreach_messages om
       LEFT JOIN contacts c ON om.contact_id = c.id WHERE om.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Message not found' });
    const msg = rows[0];

    if (!msg.contact_email) return res.status(400).json({ message: 'Contact has no email address' });
    if (!msg.subject || !msg.body) return res.status(400).json({ message: 'Subject and body required' });

    const result = await sendEmail(msg.contact_email, msg.subject, msg.body);

    await pool.query(
      `UPDATE outreach_messages SET status = 'sent', sent_at = NOW(), gmail_message_id = $1, updated_at = NOW() WHERE id = $2`,
      [result.id, req.params.id]
    );

    // Update contact last_contacted_at
    if (msg.contact_id) {
      await pool.query('UPDATE contacts SET last_contacted_at = NOW() WHERE id = $1', [msg.contact_id]);
    }

    // Implicit feedback: email was sent = AI draft was used
    pool.query(
      `UPDATE ai_interactions SET was_used = true
       WHERE entity_type = 'outreach_message' AND entity_id = $1 AND was_used IS NULL`,
      [req.params.id]
    ).catch(() => {});

    res.json({ ok: true, gmail_message_id: result.id });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ message: err.message || 'Failed to send email' });
  }
});

export default router;
