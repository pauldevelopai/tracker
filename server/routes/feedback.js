import { Router } from 'express';
import pool from '../db/pool.js';
import { callClaude } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT f.*, t.name AS user_name FROM feedback f LEFT JOIN team_members t ON f.user_id = t.id';
    const params = [];
    if (status) { params.push(status); query += ` WHERE f.status = $${params.length}`; }
    query += ' ORDER BY f.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { content, page, category, priority } = req.body;
    if (!content) return res.status(400).json({ message: 'content required' });
    const { rows } = await pool.query(
      `INSERT INTO feedback (user_id, page, category, content, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, page || null, category || 'feature', content, priority || 'medium']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, priority } = req.body;
    const { rows } = await pool.query(
      `UPDATE feedback SET status = COALESCE($1, status), priority = COALESCE($2, priority), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [status, priority, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Feedback not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/generate-prompt', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM feedback WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Feedback not found' });
    const fb = rows[0];

    const prompt = await callClaude({
      system: `You are a technical product manager converting user feedback into precise, actionable Claude Code prompts. The codebase is a Node.js/Express + React app called Holly. Convert the feedback into a prompt that a developer (or Claude Code) could execute directly.

Output ONLY the prompt — no explanation, no preamble. Start with what needs to change, reference specific files/components if obvious from the feedback, and be specific about the expected behaviour.`,
      userContent: `Feedback from page "${fb.page || 'unknown'}":\nCategory: ${fb.category}\n\n"${fb.content}"`,
      maxTokens: 1000,
      temperature: 0.2,
    });

    await pool.query('UPDATE feedback SET claude_prompt = $1, updated_at = NOW() WHERE id = $2', [prompt, fb.id]);
    res.json({ prompt });
  } catch (err) {
    console.error('Prompt generation error:', err);
    res.status(500).json({ message: err.message || 'Prompt generation failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM feedback WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Feedback not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
