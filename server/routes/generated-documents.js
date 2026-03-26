import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { generateDocument } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT gd.*, s.name AS sector_name, s.colour AS sector_colour,
        o.name AS organisation_name, dt.type AS template_type, dt.title AS template_title
      FROM generated_documents gd
      LEFT JOIN sectors s ON gd.sector_id = s.id
      LEFT JOIN organisations o ON gd.organisation_id = o.id
      LEFT JOIN document_templates dt ON gd.template_id = dt.id
      WHERE ($1::uuid IS NULL OR gd.sector_id = $1)
    `;
    const params = [req.sectorId];
    query += ' ORDER BY gd.created_at DESC';
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
      `SELECT gd.*, s.name AS sector_name, s.colour AS sector_colour,
        o.name AS organisation_name, dt.type AS template_type, dt.title AS template_title
       FROM generated_documents gd
       LEFT JOIN sectors s ON gd.sector_id = s.id
       LEFT JOIN organisations o ON gd.organisation_id = o.id
       LEFT JOIN document_templates dt ON gd.template_id = dt.id
       WHERE gd.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { template_id, sector_id, organisation_id, assessment_id, title } = req.body;
    if (!template_id || !sector_id) {
      return res.status(400).json({ message: 'template_id and sector_id required' });
    }

    // Get template
    const { rows: tmplRows } = await pool.query('SELECT * FROM document_templates WHERE id = $1', [template_id]);
    if (tmplRows.length === 0) return res.status(404).json({ message: 'Template not found' });
    const template = tmplRows[0];

    // Get sector name
    const { rows: sectorRows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [sector_id]);
    const sectorName = sectorRows[0]?.name || '';

    // Get org name
    let orgName = '';
    if (organisation_id) {
      const { rows: orgRows } = await pool.query('SELECT name FROM organisations WHERE id = $1', [organisation_id]);
      orgName = orgRows[0]?.name || '';
    }

    // Get assessment data if linked
    let assessmentData = null;
    if (assessment_id) {
      const { rows: assessRows } = await pool.query('SELECT responses FROM needs_assessments WHERE id = $1', [assessment_id]);
      assessmentData = assessRows[0] || null;
    }

    // Generate with Claude
    const content = await generateDocument(template.template_prompt, sectorName, orgName, assessmentData, template.structure);

    // Save
    const { rows } = await pool.query(
      `INSERT INTO generated_documents (template_id, sector_id, organisation_id, assessment_id, title, content, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [template_id, sector_id, organisation_id || null, assessment_id || null, title || template.title, content, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Document generation error:', err);
    res.status(500).json({ message: err.message || 'Document generation failed' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content, status, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE generated_documents SET
        title = COALESCE($1, title), content = COALESCE($2, content),
        status = COALESCE($3, status), notes = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, content, status, notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Document not found' });

    // Implicit feedback: if status changed to 'final', mark AI interaction as used
    if (status === 'final' || status === 'review') {
      pool.query(
        `UPDATE ai_interactions SET was_used = true
         WHERE entity_type = 'generated_document' AND entity_id = $1 AND was_used IS NULL`,
        [req.params.id]
      ).catch(() => {});
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/regenerate', async (req, res) => {
  try {
    const { rows: docRows } = await pool.query(
      `SELECT gd.*, dt.template_prompt, dt.structure, s.name AS sector_name, o.name AS organisation_name
       FROM generated_documents gd
       LEFT JOIN document_templates dt ON gd.template_id = dt.id
       LEFT JOIN sectors s ON gd.sector_id = s.id
       LEFT JOIN organisations o ON gd.organisation_id = o.id
       WHERE gd.id = $1`,
      [req.params.id]
    );
    if (docRows.length === 0) return res.status(404).json({ message: 'Document not found' });
    const doc = docRows[0];

    let assessmentData = null;
    if (doc.assessment_id) {
      const { rows } = await pool.query('SELECT responses FROM needs_assessments WHERE id = $1', [doc.assessment_id]);
      assessmentData = rows[0] || null;
    }

    const content = await generateDocument(doc.template_prompt, doc.sector_name, doc.organisation_name, assessmentData, doc.structure);

    const { rows: updated } = await pool.query(
      `UPDATE generated_documents SET content = $1, status = 'draft', updated_at = NOW() WHERE id = $2 RETURNING *`,
      [content, req.params.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('Regeneration error:', err);
    res.status(500).json({ message: err.message || 'Regeneration failed' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM generated_documents WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Document not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
