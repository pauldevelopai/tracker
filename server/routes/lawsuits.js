import { Router } from 'express';
import pool from '../db/pool.js';
import { runLawsuitTracker } from '../services/background-jobs.js';

const router = Router();

// List all cases with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, defendant, jurisdiction, case_type, q } = req.query;
    let query = 'SELECT * FROM ai_lawsuits WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (defendant) {
      params.push(`%${defendant}%`);
      query += ` AND EXISTS (SELECT 1 FROM unnest(defendants) d WHERE d ILIKE $${params.length})`;
    }
    if (jurisdiction && jurisdiction !== 'all') {
      params.push(jurisdiction);
      query += ` AND jurisdiction = $${params.length}`;
    }
    if (case_type && case_type !== 'all') {
      params.push(case_type);
      query += ` AND case_type = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (case_name ILIKE $${params.length} OR summary ILIKE $${params.length} OR EXISTS (SELECT 1 FROM unnest(defendants) d WHERE d ILIKE $${params.length}) OR EXISTS (SELECT 1 FROM unnest(plaintiffs) p WHERE p ILIKE $${params.length}))`;
    }

    query += ' ORDER BY CASE WHEN status = \'active\' THEN 0 WHEN status = \'appealing\' THEN 1 ELSE 2 END, updated_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Summary stats
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'appealing') AS appealing,
        COUNT(*) FILTER (WHERE status = 'settled') AS settled,
        COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed,
        COUNT(*) FILTER (WHERE status = 'decided') AS decided,
        COUNT(*) AS total,
        MAX(updated_at) AS last_updated
      FROM ai_lawsuits
    `);

    // Top defendants
    const { rows: defendants } = await pool.query(`
      SELECT d AS defendant, COUNT(*) AS case_count
      FROM ai_lawsuits, UNNEST(defendants) AS d
      WHERE status IN ('active', 'appealing')
      GROUP BY d
      ORDER BY case_count DESC
      LIMIT 8
    `);

    // Upcoming deadlines
    const { rows: deadlines } = await pool.query(`
      SELECT id, case_name, next_deadline, next_deadline_notes, status
      FROM ai_lawsuits
      WHERE next_deadline IS NOT NULL AND next_deadline >= CURRENT_DATE AND status IN ('active', 'appealing')
      ORDER BY next_deadline ASC
      LIMIT 5
    `);

    res.json({ ...rows[0], defendants, deadlines });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single case
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ai_lawsuits WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new case manually
router.post('/', async (req, res) => {
  try {
    const {
      case_name, plaintiffs, defendants, court, judge, jurisdiction, district, circuit,
      status, case_type, key_issues, filing_date, last_update, next_deadline, next_deadline_notes,
      outcome, settlement_amount, case_url, source_url, summary, curriculum_relevance, is_curriculum_relevant,
    } = req.body;

    if (!case_name) return res.status(400).json({ message: 'case_name required' });

    const { rows } = await pool.query(
      `INSERT INTO ai_lawsuits
        (case_name, plaintiffs, defendants, court, judge, jurisdiction, district, circuit,
         status, case_type, key_issues, filing_date, last_update, next_deadline, next_deadline_notes,
         outcome, settlement_amount, case_url, source_url, summary, curriculum_relevance, is_curriculum_relevant)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        case_name, plaintiffs || [], defendants || [], court || null, judge || null,
        jurisdiction || 'US Federal', district || null, circuit || null,
        status || 'active', case_type || 'copyright', key_issues || [],
        filing_date || null, last_update || null, next_deadline || null, next_deadline_notes || null,
        outcome || null, settlement_amount || null, case_url || null, source_url || null,
        summary || null, curriculum_relevance || null, is_curriculum_relevant !== false,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

// Update a case
router.put('/:id', async (req, res) => {
  try {
    const fields = [
      'case_name', 'plaintiffs', 'defendants', 'court', 'judge', 'jurisdiction', 'district', 'circuit',
      'status', 'case_type', 'key_issues', 'filing_date', 'last_update', 'next_deadline',
      'next_deadline_notes', 'outcome', 'settlement_amount', 'case_url', 'source_url',
      'summary', 'curriculum_relevance', 'is_curriculum_relevant',
    ];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(req.params.id);
    updates.push(`updated_at = NOW()`);

    const { rows } = await pool.query(
      `UPDATE ai_lawsuits SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Trigger the lawsuit tracker background job manually
router.post('/refresh', async (req, res) => {
  try {
    const result = await runLawsuitTracker();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Refresh failed' });
  }
});

export default router;
