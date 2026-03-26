import { Router } from 'express';
import pool from '../db/pool.js';
import { chatWithResearchAssistant } from '../services/claude.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, course_id, user_id, title, created_at, updated_at FROM ai_conversations WHERE course_id = $1 ORDER BY updated_at DESC',
      [req.params.courseId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_conversations WHERE id = $1 AND course_id = $2',
      [req.params.id, req.params.courseId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO ai_conversations (course_id, user_id, title, messages)
       VALUES ($1, $2, $3, '[]') RETURNING *`,
      [req.params.courseId, req.user.id, title || 'New Research']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/message', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'content required' });

    // Get conversation
    const { rows: convRows } = await pool.query(
      'SELECT * FROM ai_conversations WHERE id = $1 AND course_id = $2',
      [req.params.id, req.params.courseId]
    );
    if (convRows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    const conversation = convRows[0];

    // Get course context
    const { rows: courseRows } = await pool.query(
      `SELECT c.*, s.name AS sector_name FROM courses c
       LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1`,
      [req.params.courseId]
    );
    const course = courseRows[0];

    // Get modules
    const { rows: modules } = await pool.query(
      'SELECT title, description FROM course_modules WHERE course_id = $1 ORDER BY order_index',
      [req.params.courseId]
    );

    const courseContext = {
      title: course.title,
      sectorName: course.sector_name,
      description: course.description,
      modules,
    };

    // Call Claude
    const aiResponse = await chatWithResearchAssistant(courseContext, conversation.messages, content);

    // Update messages
    const now = new Date().toISOString();
    const updatedMessages = [
      ...conversation.messages,
      { role: 'user', content, timestamp: now },
      { role: 'assistant', content: aiResponse, timestamp: now },
    ];

    const { rows: updated } = await pool.query(
      `UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(updatedMessages), req.params.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('AI conversation error:', err);
    res.status(500).json({ message: err.message || 'AI conversation failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM ai_conversations WHERE id = $1 AND course_id = $2',
      [req.params.id, req.params.courseId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
