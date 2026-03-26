import { Router } from 'express';
import pool from '../db/pool.js';
import { generatePersonalisedTasks, reviewSubmission } from '../services/claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { contact_id, cohort_id, status, limit } = req.query;
    let query = `
      SELECT lt.*, c.first_name, c.last_name, c.job_title, o.name AS org_name, lo.title AS outcome_title
      FROM learning_tasks lt
      LEFT JOIN contacts c ON lt.contact_id = c.id
      LEFT JOIN organisations o ON c.organisation_id = o.id
      LEFT JOIN learning_outcomes lo ON lt.outcome_id = lo.id
      WHERE 1=1
    `;
    const params = [];
    if (contact_id) { params.push(contact_id); query += ` AND lt.contact_id = $${params.length}`; }
    if (cohort_id) { params.push(cohort_id); query += ` AND lt.cohort_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND lt.status = $${params.length}`; }
    query += ' ORDER BY lt.created_at DESC';
    if (limit) { params.push(parseInt(limit)); query += ` LIMIT $${params.length}`; }
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
      `SELECT lt.*, c.first_name, c.last_name, c.job_title, o.name AS org_name, lo.title AS outcome_title, lo.assessment_criteria
       FROM learning_tasks lt
       LEFT JOIN contacts c ON lt.contact_id = c.id
       LEFT JOIN organisations o ON c.organisation_id = o.id
       LEFT JOIN learning_outcomes lo ON lt.outcome_id = lo.id
       WHERE lt.id = $1`,
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
    const { contact_id, participant_id, cohort_id, outcome_id, title, description, task_type, difficulty, due_date } = req.body;
    if (!contact_id || !title) return res.status(400).json({ message: 'contact_id and title required' });
    const { rows } = await pool.query(
      `INSERT INTO learning_tasks (contact_id, participant_id, cohort_id, outcome_id, title, description, task_type, difficulty, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [contact_id, participant_id || null, cohort_id || null, outcome_id || null, title, description || null, task_type || 'deliverable', difficulty || 'beginner', due_date || null]
    );
    // Update journey last_activity_at
    await pool.query('UPDATE learning_journeys SET last_activity_at = NOW() WHERE contact_id = $1', [contact_id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI generate personalised tasks
router.post('/generate', async (req, res) => {
  try {
    const { contact_id, course_id, skill_level } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });

    // Get contact + org
    const { rows: [contact] } = await pool.query(
      `SELECT c.*, o.name AS org_name, o.type AS org_type FROM contacts c
       LEFT JOIN organisations o ON c.organisation_id = o.id WHERE c.id = $1`, [contact_id]
    );
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const org = { name: contact.org_name, type: contact.org_type };

    // Get course + outcomes
    let course = null, outcomes = [];
    if (course_id) {
      const { rows: [c] } = await pool.query(
        'SELECT co.*, s.name AS sector_name FROM courses co LEFT JOIN sectors s ON co.sector_id = s.id WHERE co.id = $1', [course_id]
      );
      course = c;
      const { rows: o } = await pool.query('SELECT * FROM learning_outcomes WHERE course_id = $1 ORDER BY order_index', [course_id]);
      outcomes = o;
    }

    const tasks = await generatePersonalisedTasks(contact, org, course, outcomes, skill_level || 'beginner');

    // Save generated tasks
    const saved = [];
    for (const t of tasks) {
      const outcomeId = (typeof t.outcome_index === 'number' && outcomes[t.outcome_index]) ? outcomes[t.outcome_index].id : null;
      const { rows: [task] } = await pool.query(
        `INSERT INTO learning_tasks (contact_id, cohort_id, outcome_id, title, description, task_type, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [contact_id, null, outcomeId, t.title, t.description, t.task_type || 'deliverable', t.difficulty || 'beginner']
      );
      saved.push(task);
    }

    // Ensure learning journey exists
    const { rows: existingJourney } = await pool.query('SELECT id FROM learning_journeys WHERE contact_id = $1', [contact_id]);
    if (existingJourney.length === 0) {
      await pool.query(
        `INSERT INTO learning_journeys (contact_id, organisation_id, sector_id, skill_level)
         VALUES ($1, $2, $3, $4)`,
        [contact_id, contact.organisation_id, contact.sector_id, skill_level || 'beginner']
      );
    }

    res.json({ generated: saved.length, tasks: saved });
  } catch (err) {
    console.error('Task generation error:', err);
    res.status(500).json({ message: err.message || 'Task generation failed' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, task_type, difficulty, due_date, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE learning_tasks SET title = COALESCE($1, title), description = COALESCE($2, description),
       task_type = COALESCE($3, task_type), difficulty = COALESCE($4, difficulty),
       due_date = $5, status = COALESCE($6, status), updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, description, task_type, difficulty, due_date, status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Paul reviews a submission
router.post('/:id/review', async (req, res) => {
  try {
    const { status, review_notes, review_score } = req.body;
    const newStatus = status || 'approved';
    const { rows } = await pool.query(
      `UPDATE learning_tasks SET status = $1, reviewer_id = $2, review_notes = $3, review_score = $4,
       approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [newStatus, req.user.id, review_notes || null, review_score || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });

    // Recalculate journey progress
    const task = rows[0];
    if (task.contact_id) {
      const { rows: allTasks } = await pool.query('SELECT status FROM learning_tasks WHERE contact_id = $1', [task.contact_id]);
      const approved = allTasks.filter(t => t.status === 'approved').length;
      const progress = allTasks.length > 0 ? Math.round((approved / allTasks.length) * 100) : 0;
      await pool.query('UPDATE learning_journeys SET overall_progress = $1, last_activity_at = NOW() WHERE contact_id = $2', [progress, task.contact_id]);
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// AI reviews a submission
router.post('/:id/ai-review', async (req, res) => {
  try {
    const { rows: [task] } = await pool.query(
      `SELECT lt.*, lo.assessment_criteria FROM learning_tasks lt
       LEFT JOIN learning_outcomes lo ON lt.outcome_id = lo.id WHERE lt.id = $1`,
      [req.params.id]
    );
    if (!task) return res.status(404).json({ message: 'Not found' });
    if (!task.submission_text && !task.submission_url) return res.status(400).json({ message: 'No submission to review' });

    const review = await reviewSubmission(task, task.submission_text, task.submission_url);

    // Extract score
    const scoreMatch = review.match(/SCORE:\s*(\d)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    await pool.query('UPDATE learning_tasks SET ai_review = $1, updated_at = NOW() WHERE id = $2', [review, req.params.id]);

    res.json({ review, score });
  } catch (err) {
    console.error('AI review error:', err);
    res.status(500).json({ message: err.message || 'AI review failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM learning_tasks WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
