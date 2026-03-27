import { Router } from 'express';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { suggestCourseImprovements, analyseFeedbackTrends, researchIndustryTrends } from '../services/claude.js';
import moduleRoutes from './course-modules.js';
import conversationRoutes from './ai-conversations.js';

const router = Router();

router.use('/:courseId/modules', moduleRoutes);
router.use('/:courseId/conversations', conversationRoutes);

// Intelligence endpoints (must be before /:id routes)
router.get('/intelligence', async (req, res) => {
  try {
    const { rows: courses } = await pool.query(
      `SELECT c.id, c.title, c.effectiveness_score, c.status,
        (SELECT count(*) FROM course_modules cm WHERE cm.course_id = c.id)::int AS module_count,
        (SELECT ROUND(AVG(cm.effectiveness_rating)::numeric, 1) FROM course_modules cm WHERE cm.course_id = c.id AND cm.effectiveness_rating IS NOT NULL) AS avg_module_effectiveness
       FROM courses c WHERE ($1::uuid IS NULL OR c.sector_id = $1) ORDER BY c.title`,
      [req.sectorId]
    );

    const { rows: lowModules } = await pool.query(
      `SELECT cm.title AS module_title, cm.effectiveness_rating, cm.feedback_notes, c.title AS course_title
       FROM course_modules cm JOIN courses c ON cm.course_id = c.id
       WHERE cm.effectiveness_rating IS NOT NULL AND cm.effectiveness_rating <= 3
       AND ($1::uuid IS NULL OR c.sector_id = $1)
       ORDER BY cm.effectiveness_rating, cm.title`,
      [req.sectorId]
    );

    const avgAll = courses.reduce((sum, c) => sum + (parseFloat(c.avg_module_effectiveness) || 0), 0) / (courses.filter(c => c.avg_module_effectiveness).length || 1);

    res.json({ courses, lowestRatedModules: lowModules, overallAvgEffectiveness: Math.round(avgAll * 10) / 10 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/intelligence/analyse', async (req, res) => {
  try {
    const { rows: courses } = await pool.query(
      `SELECT c.title, c.effectiveness_score FROM courses c WHERE ($1::uuid IS NULL OR c.sector_id = $1)`,
      [req.sectorId]
    );
    const { rows: modules } = await pool.query(
      `SELECT cm.title, cm.effectiveness_rating, cm.feedback_notes, c.title AS course_title
       FROM course_modules cm JOIN courses c ON cm.course_id = c.id
       WHERE ($1::uuid IS NULL OR c.sector_id = $1) ORDER BY c.title, cm.order_index`,
      [req.sectorId]
    );
    let sectorName = 'all sectors';
    if (req.sectorId) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [req.sectorId]);
      sectorName = rows[0]?.name || 'all sectors';
    }
    const analysis = await analyseFeedbackTrends(courses, modules, sectorName);
    res.json({ analysis });
  } catch (err) {
    console.error('Intelligence analyse error:', err);
    res.status(500).json({ message: err.message || 'Analysis failed' });
  }
});

router.post('/intelligence/research', async (req, res) => {
  try {
    const { rows: courses } = await pool.query(
      `SELECT c.title FROM courses c WHERE ($1::uuid IS NULL OR c.sector_id = $1)`,
      [req.sectorId]
    );
    const currentTopics = courses.map(c => c.title).join(', ');
    let sectorName = 'all sectors';
    if (req.sectorId) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [req.sectorId]);
      sectorName = rows[0]?.name || 'all sectors';
    }
    const research = await researchIndustryTrends(sectorName, currentTopics);
    res.json({ research });
  } catch (err) {
    console.error('Intelligence research error:', err);
    res.status(500).json({ message: err.message || 'Research failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT c.*, s.name AS sector_name, s.colour AS sector_colour,
        t.name AS last_updated_by_name,
        (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id) AS module_count
      FROM courses c
      LEFT JOIN sectors s ON c.sector_id = s.id
      LEFT JOIN team_members t ON c.last_updated_by = t.id
      WHERE ($1::uuid IS NULL OR c.sector_id = $1)
    `;
    const params = [req.sectorId];

    if (req.query.status) {
      params.push(req.query.status);
      query += ` AND c.status = $${params.length}`;
    }

    query += ' ORDER BY c.title';
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
      `SELECT c.*, s.name AS sector_name, s.colour AS sector_colour,
        t.name AS last_updated_by_name
       FROM courses c
       LEFT JOIN sectors s ON c.sector_id = s.id
       LEFT JOIN team_members t ON c.last_updated_by = t.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Course not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sector_id, title, description, notes, delivery_type, version, status } = req.body;
    if (!sector_id || !title) return res.status(400).json({ message: 'sector_id and title required' });
    const { rows } = await pool.query(
      `INSERT INTO courses (sector_id, title, description, notes, delivery_type, version, status, last_updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sector_id, title, description || null, notes || null, delivery_type || 'both', version || 'v1.0', status || 'draft', req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { sector_id, title, description, notes, delivery_type, version, status, effectiveness_score } = req.body;
    const { rows } = await pool.query(
      `UPDATE courses SET
        sector_id = COALESCE($1, sector_id), title = COALESCE($2, title),
        description = $3, notes = $4, delivery_type = COALESCE($5, delivery_type),
        version = COALESCE($6, version), status = COALESCE($7, status),
        effectiveness_score = $8, last_updated_by = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [sector_id, title, description, notes, delivery_type, version, status, effectiveness_score, req.user.id, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Course not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/ai-assist', async (req, res) => {
  try {
    const { rows: courseRows } = await pool.query(
      `SELECT c.*, s.name AS sector_name FROM courses c
       LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1`,
      [req.params.id]
    );
    if (courseRows.length === 0) return res.status(404).json({ message: 'Course not found' });
    const course = courseRows[0];

    const { rows: modules } = await pool.query(
      'SELECT * FROM course_modules WHERE course_id = $1 ORDER BY order_index',
      [req.params.id]
    );

    const suggestions = await suggestCourseImprovements(course, modules, course.sector_name);
    res.json({ suggestions });
  } catch (err) {
    console.error('AI assist error:', err);
    res.status(500).json({ message: err.message || 'AI assist failed' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Course not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
