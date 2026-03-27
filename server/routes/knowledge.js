import { Router } from 'express';
import pool from '../db/pool.js';
import { searchKnowledge, getKnowledgeStats, createKnowledgeEntry } from '../services/knowledge.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await getKnowledgeStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, sector_id } = req.query;
    if (!q) return res.status(400).json({ message: 'q required' });
    const results = await searchKnowledge(q, { sectorId: sector_id });
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, sector_id, verified, limit } = req.query;
    let query = `
      SELECT ke.*, s.name AS sector_name,
        (SELECT array_agg(tag) FROM knowledge_tags kt WHERE kt.knowledge_id = ke.id) AS tags
      FROM knowledge_entries ke
      LEFT JOIN sectors s ON ke.sector_id = s.id
      WHERE ke.is_active = true
    `;
    const params = [];
    if (category) { params.push(category); query += ` AND ke.category = $${params.length}`; }
    if (sector_id) { params.push(sector_id); query += ` AND (ke.sector_id = $${params.length} OR ke.sector_id IS NULL)`; }
    if (verified === 'true') query += ' AND ke.is_verified = true';
    query += ' ORDER BY ke.created_at DESC';
    params.push(parseInt(limit) || 50);
    query += ` LIMIT $${params.length}`;
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
      `SELECT ke.*, s.name AS sector_name, o.name AS organisation_name, c.title AS course_title,
        (SELECT array_agg(tag) FROM knowledge_tags kt WHERE kt.knowledge_id = ke.id) AS tags
       FROM knowledge_entries ke
       LEFT JOIN sectors s ON ke.sector_id = s.id
       LEFT JOIN organisations o ON ke.organisation_id = o.id
       LEFT JOIN courses c ON ke.course_id = c.id
       WHERE ke.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { category, subcategory, title, content, sector_id, organisation_id, course_id, tags, confidence } = req.body;
    if (!category || !title || !content) return res.status(400).json({ message: 'category, title, content required' });
    const id = await createKnowledgeEntry({
      category, subcategory, title, content,
      sectorId: sector_id, organisationId: organisation_id, courseId: course_id,
      sourceType: 'manual', sourceDescription: `Added by ${req.user.name}`,
      confidence: confidence || 0.7, tags,
    });
    const { rows } = await pool.query('SELECT * FROM knowledge_entries WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content, category, is_verified, is_active, confidence } = req.body;
    const { rows } = await pool.query(
      `UPDATE knowledge_entries SET
        title = COALESCE($1, title), content = COALESCE($2, content),
        category = COALESCE($3, category), is_verified = COALESCE($4, is_verified),
        is_active = COALESCE($5, is_active), confidence = COALESCE($6, confidence),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, content, category, is_verified, is_active, confidence, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI feedback on interactions
router.put('/interactions/:id/feedback', async (req, res) => {
  try {
    const { was_used, user_rating, feedback_notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE ai_interactions SET was_used = $1, user_rating = $2, feedback_notes = $3
       WHERE id = $4 RETURNING id`,
      [was_used, user_rating || null, feedback_notes || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Train AI from all course materials, modules, and uploaded documents
router.post('/train-from-materials', async (req, res) => {
  try {
    let processed = 0;
    let newEntries = 0;

    // 1. Process all course modules
    const { rows: modules } = await pool.query(
      `SELECT cm.id, cm.title, cm.description, cm.content, cm.feedback_notes, cm.effectiveness_rating,
        c.title AS course_title, c.sector_id, s.name AS sector_name
       FROM course_modules cm
       JOIN courses c ON cm.course_id = c.id
       LEFT JOIN sectors s ON c.sector_id = s.id
       ORDER BY c.title, cm.order_index`
    );

    for (const mod of modules) {
      processed++;
      // Check if knowledge entry already exists for this module
      const { rows: existing } = await pool.query(
        "SELECT id FROM knowledge_entries WHERE source = $1 AND source_id = $2",
        ['course_module', mod.id]
      );
      if (existing.length > 0) continue;

      const content = [
        `Course: ${mod.course_title}`,
        `Module: ${mod.title}`,
        mod.description ? `Description: ${mod.description}` : '',
        mod.content ? `Content: ${mod.content.slice(0, 2000)}` : '',
        mod.feedback_notes ? `Trainer feedback: ${mod.feedback_notes}` : '',
        mod.effectiveness_rating ? `Effectiveness: ${mod.effectiveness_rating}/5` : '',
      ].filter(Boolean).join('\n');

      await createKnowledgeEntry({
        title: `${mod.course_title} — ${mod.title}`,
        content,
        category: 'curriculum',
        source: 'course_module',
        sourceId: mod.id,
        sectorId: mod.sector_id,
        tags: ['course', 'module', mod.sector_name?.toLowerCase()].filter(Boolean),
        confidence: mod.effectiveness_rating ? mod.effectiveness_rating / 5 : 0.5,
      });
      newEntries++;
    }

    // 2. Process uploaded training materials
    const { rows: uploads } = await pool.query(
      "SELECT id, original_name, extracted_text, sector_id FROM uploaded_documents WHERE entity_type = 'training_material' AND extracted_text IS NOT NULL"
    );

    for (const doc of uploads) {
      processed++;
      const { rows: existing } = await pool.query(
        "SELECT id FROM knowledge_entries WHERE source = $1 AND source_id = $2",
        ['uploaded_document', doc.id]
      );
      if (existing.length > 0) continue;

      await createKnowledgeEntry({
        title: `Training material: ${doc.original_name}`,
        content: doc.extracted_text.slice(0, 5000),
        category: 'curriculum',
        source: 'uploaded_document',
        sourceId: doc.id,
        sectorId: doc.sector_id,
        tags: ['training_material', 'uploaded'],
        confidence: 0.6,
      });
      newEntries++;
    }

    res.json({ processed, newEntries });
  } catch (err) {
    console.error('Train from materials error:', err);
    res.status(500).json({ message: err.message || 'Training failed' });
  }
});

export default router;
