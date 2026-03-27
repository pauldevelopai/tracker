import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Map data — enriched with AI implementation strength indicators
router.get('/map', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.name, o.type, o.country, o.city, o.latitude, o.longitude,
        o.relationship_stage, o.programme_name, o.funder_organisation_id,
        s.name AS sector_name,
        (SELECT COUNT(*) FROM contacts c WHERE c.organisation_id = o.id)::int AS contact_count,
        EXISTS(SELECT 1 FROM generated_documents gd JOIN document_templates dt ON gd.template_id = dt.id WHERE gd.organisation_id = o.id AND dt.type = 'ethical_ai_policy') AS has_policy,
        EXISTS(SELECT 1 FROM generated_documents gd JOIN document_templates dt ON gd.template_id = dt.id WHERE gd.organisation_id = o.id AND dt.type = 'ai_legal_framework') AS has_framework,
        EXISTS(SELECT 1 FROM generated_documents gd JOIN document_templates dt ON gd.template_id = dt.id WHERE gd.organisation_id = o.id AND dt.type = 'ai_security_framework') AS has_security,
        EXISTS(SELECT 1 FROM service_engagements se WHERE se.organisation_id = o.id AND se.type = 'mentorship' AND se.status IN ('active', 'completed')) AS has_mentorship,
        COALESCE((SELECT AVG(lj.overall_progress) FROM learning_journeys lj WHERE lj.organisation_id = o.id), 0)::int AS learning_progress
      FROM organisations o
      LEFT JOIN sectors s ON o.sector_id = s.id
      WHERE ($1::uuid IS NULL OR o.sector_id = $1)
      ORDER BY o.name
    `, [req.sectorId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
      `SELECT o.*, s.name AS sector_name, s.colour AS sector_colour, fo.name AS funder_name
       FROM organisations o
       LEFT JOIN sectors s ON o.sector_id = s.id
       LEFT JOIN organisations fo ON o.funder_organisation_id = fo.id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Organisation not found' });
    const org = rows[0];

    // Cohorts this org is in
    const { rows: cohorts } = await pool.query(
      `SELECT c.id, c.name, c.status, c.delivery_type, co.name AS client_name
       FROM cohort_organisations corg JOIN cohorts c ON corg.cohort_id = c.id
       LEFT JOIN organisations co ON c.client_organisation_id = co.id
       WHERE corg.organisation_id = $1 ORDER BY c.name`,
      [req.params.id]
    );

    // Courses linked via cohorts
    const { rows: courses } = await pool.query(
      `SELECT DISTINCT c.id, c.title, c.status, c.version
       FROM cohort_organisations corg JOIN cohort_courses cc ON cc.cohort_id = corg.cohort_id
       JOIN courses c ON cc.course_id = c.id WHERE corg.organisation_id = $1`,
      [req.params.id]
    );

    // Mentoring engagements
    const { rows: mentoring } = await pool.query(
      `SELECT se.id, se.type, se.status, se.start_date, se.session_count, t.name AS mentor_name
       FROM service_engagements se LEFT JOIN team_members t ON se.mentor_id = t.id
       WHERE se.organisation_id = $1 ORDER BY se.start_date DESC NULLS LAST`,
      [req.params.id]
    );

    // Learning journeys
    const { rows: learners } = await pool.query(
      `SELECT lj.id, lj.status, lj.overall_progress, lj.skill_level, c.first_name, c.last_name
       FROM learning_journeys lj JOIN contacts c ON lj.contact_id = c.id
       WHERE lj.organisation_id = $1 ORDER BY lj.overall_progress DESC`,
      [req.params.id]
    );

    // Documents
    const { rows: documents } = await pool.query(
      `SELECT gd.id, gd.title, gd.status, dt.type AS template_type
       FROM generated_documents gd LEFT JOIN document_templates dt ON gd.template_id = dt.id
       WHERE gd.organisation_id = $1 ORDER BY gd.created_at DESC`,
      [req.params.id]
    );

    // AI implementation score
    const hasPolicy = documents.some(d => d.template_type === 'ethical_ai_policy' && d.status === 'final');
    const hasFramework = documents.some(d => d.template_type === 'ai_legal_framework' && d.status === 'final');
    const hasSecurity = documents.some(d => d.template_type === 'ai_security_framework' && d.status === 'final');
    const hasMentoring = mentoring.some(m => m.status === 'active');
    const avgProgress = learners.length > 0 ? learners.reduce((s, l) => s + (l.overall_progress || 0), 0) / learners.length : 0;
    let aiScore = 0;
    if (hasPolicy) aiScore += 2; if (hasFramework) aiScore += 2; if (hasSecurity) aiScore += 1;
    if (hasMentoring) aiScore += 2; if (avgProgress > 50) aiScore += 2; else if (avgProgress > 0) aiScore += 1;
    if (org.relationship_stage === 'active') aiScore += 1;
    const aiLevel = aiScore >= 9 ? 'excellent' : aiScore >= 6 ? 'strong' : aiScore >= 3 ? 'in_progress' : 'starting';

    res.json({ ...org, cohorts, courses, mentoring, learners, documents,
      ai_implementation: { score: aiScore, level: aiLevel, hasPolicy, hasFramework, hasSecurity, hasMentoring, avgProgress } });
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
