import { Router } from 'express';
import pool from '../db/pool.js';
import { chatWithCurriculumBuilder, chatWithLeadFinder, chatWithImplementationCoach } from '../services/claude.js';

const router = Router();

const CHAT_FUNCTIONS = {
  curriculum_builder: chatWithCurriculumBuilder,
  lead_finder: chatWithLeadFinder,
  implementation_coach: chatWithImplementationCoach,
};

// Load context data based on agent type
async function loadAgentContext(agentType, contextJson) {
  const ctx = contextJson || {};

  if (agentType === 'curriculum_builder') {
    let course = null, modules = [], sectorName = 'all sectors';
    if (ctx.course_id) {
      const { rows } = await pool.query(
        `SELECT c.*, s.name AS sector_name FROM courses c LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1`, [ctx.course_id]
      );
      course = rows[0];
      sectorName = course?.sector_name || 'all sectors';
      const { rows: mods } = await pool.query('SELECT title, description FROM course_modules WHERE course_id = $1 ORDER BY order_index', [ctx.course_id]);
      modules = mods;
    }
    if (ctx.sector_id && !course) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [ctx.sector_id]);
      sectorName = rows[0]?.name || 'all sectors';
    }
    return { course, modules, sectorName };
  }

  if (agentType === 'lead_finder') {
    let sectorName = 'all sectors', campaignGoal = '';
    if (ctx.sector_id) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [ctx.sector_id]);
      sectorName = rows[0]?.name || 'all sectors';
    }
    if (ctx.campaign_id) {
      const { rows } = await pool.query('SELECT name, target_audience, notes FROM outreach_campaigns WHERE id = $1', [ctx.campaign_id]);
      campaignGoal = rows[0]?.target_audience || rows[0]?.notes || '';
    }
    return { sectorName, campaignGoal };
  }

  if (agentType === 'implementation_coach') {
    let sectorName = 'all sectors', cohortData = null, journeys = [];
    if (ctx.sector_id) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [ctx.sector_id]);
      sectorName = rows[0]?.name || 'all sectors';
    }
    if (ctx.cohort_id) {
      const { rows } = await pool.query(
        `SELECT c.name, co.name AS client_name FROM cohorts c LEFT JOIN organisations co ON c.client_organisation_id = co.id WHERE c.id = $1`, [ctx.cohort_id]
      );
      cohortData = rows[0];
      const { rows: j } = await pool.query(
        `SELECT lj.*, ct.first_name, ct.last_name, o.name AS org_name
         FROM learning_journeys lj
         LEFT JOIN contacts ct ON lj.contact_id = ct.id
         LEFT JOIN organisations o ON lj.organisation_id = o.id
         WHERE lj.sector_id = (SELECT sector_id FROM cohorts WHERE id = $1)
         ORDER BY lj.overall_progress DESC`, [ctx.cohort_id]
      );
      journeys = j;
    }
    return { sectorName, cohortData, journeys };
  }

  return {};
}

router.get('/', async (req, res) => {
  try {
    const { agent_type } = req.query;
    if (!agent_type) return res.status(400).json({ message: 'agent_type required' });
    const { rows } = await pool.query(
      'SELECT id, agent_type, user_id, title, context, created_at, updated_at FROM agent_conversations WHERE agent_type = $1 AND user_id = $2 ORDER BY updated_at DESC',
      [agent_type, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM agent_conversations WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { agent_type, title, context } = req.body;
    if (!agent_type) return res.status(400).json({ message: 'agent_type required' });
    const { rows } = await pool.query(
      `INSERT INTO agent_conversations (agent_type, user_id, title, context, messages)
       VALUES ($1, $2, $3, $4, '[]') RETURNING *`,
      [agent_type, req.user.id, title || 'New conversation', context || {}]
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

    const { rows: convRows } = await pool.query('SELECT * FROM agent_conversations WHERE id = $1', [req.params.id]);
    if (convRows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    const conversation = convRows[0];

    const chatFn = CHAT_FUNCTIONS[conversation.agent_type];
    if (!chatFn) return res.status(400).json({ message: `Unknown agent type: ${conversation.agent_type}` });

    // Load context
    const agentContext = await loadAgentContext(conversation.agent_type, conversation.context);

    // Call Claude
    const aiResponse = await chatFn(agentContext, conversation.messages, content);

    // Update messages
    const now = new Date().toISOString();
    const updatedMessages = [
      ...conversation.messages,
      { role: 'user', content, timestamp: now },
      { role: 'assistant', content: aiResponse, timestamp: now },
    ];

    // Auto-title from first message
    let titleUpdate = '';
    if (conversation.messages.length === 0) {
      const autoTitle = content.slice(0, 60) + (content.length > 60 ? '...' : '');
      titleUpdate = `, title = $3`;
    }

    const updateQuery = titleUpdate
      ? 'UPDATE agent_conversations SET messages = $1, updated_at = NOW(), title = $3 WHERE id = $2 RETURNING *'
      : 'UPDATE agent_conversations SET messages = $1, updated_at = NOW() WHERE id = $2 RETURNING *';

    const updateParams = titleUpdate
      ? [JSON.stringify(updatedMessages), req.params.id, content.slice(0, 60) + (content.length > 60 ? '...' : '')]
      : [JSON.stringify(updatedMessages), req.params.id];

    const { rows: updated } = await pool.query(updateQuery, updateParams);
    res.json(updated[0]);
  } catch (err) {
    console.error('Agent conversation error:', err);
    res.status(500).json({ message: err.message || 'Agent conversation failed' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, context } = req.body;
    const { rows } = await pool.query(
      'UPDATE agent_conversations SET title = COALESCE($1, title), context = COALESCE($2, context), updated_at = NOW() WHERE id = $3 RETURNING *',
      [title, context, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM agent_conversations WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
