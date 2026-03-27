import { Router } from 'express';
import pool from '../db/pool.js';
import {
  generateCourseStructure, generateModuleContent,
  generateOutreachStrategy, draftLinkedInMessage, suggestLeadTargets,
  generateFollowUpTasks, draftNudgeEmail, assessCohortProgress, draftColdEmail,
} from '../services/claude.js';
import { sendEmail } from '../services/gmail.js';

const router = Router();

// ── CURRICULUM BUILDER ACTIONS ──

router.post('/curriculum/generate-structure', async (req, res) => {
  try {
    const { sector_id, topic, target_audience } = req.body;
    if (!topic) return res.status(400).json({ message: 'topic required' });
    let sectorName = 'General';
    if (sector_id) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [sector_id]);
      sectorName = rows[0]?.name || 'General';
    }
    const structure = await generateCourseStructure(sectorName, topic, target_audience);
    res.json(structure);
  } catch (err) {
    console.error('Generate structure error:', err);
    res.status(500).json({ message: err.message || 'Generation failed' });
  }
});

router.post('/curriculum/apply-structure', async (req, res) => {
  try {
    const { sector_id, structure } = req.body;
    if (!structure?.title || !structure?.modules) return res.status(400).json({ message: 'structure with title and modules required' });

    // Create course
    const { rows: [course] } = await pool.query(
      `INSERT INTO courses (sector_id, title, description, delivery_type, status, last_updated_by)
       VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
      [sector_id, structure.title, structure.description || '', structure.delivery_type || 'both', req.user.id]
    );

    // Create modules
    for (let i = 0; i < structure.modules.length; i++) {
      const m = structure.modules[i];
      await pool.query(
        `INSERT INTO course_modules (course_id, title, description, order_index, duration_minutes, content)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [course.id, m.title, m.description || '', i, m.duration_minutes || 60, m.content_outline || '']
      );
    }

    res.status(201).json({ course_id: course.id, module_count: structure.modules.length });
  } catch (err) {
    console.error('Apply structure error:', err);
    res.status(500).json({ message: err.message || 'Failed to create course' });
  }
});

router.post('/curriculum/generate-module-content', async (req, res) => {
  try {
    const { course_id, module_id } = req.body;
    const { rows: courses } = await pool.query(
      'SELECT c.*, s.name AS sector_name FROM courses c LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1', [course_id]
    );
    if (courses.length === 0) return res.status(404).json({ message: 'Course not found' });
    const { rows: modules } = await pool.query('SELECT * FROM course_modules WHERE id = $1', [module_id]);
    if (modules.length === 0) return res.status(404).json({ message: 'Module not found' });

    const content = await generateModuleContent(courses[0], modules[0], courses[0].sector_name);

    // Save to module
    await pool.query('UPDATE course_modules SET content = $1, updated_at = NOW() WHERE id = $2', [content, module_id]);

    res.json({ content, module_id });
  } catch (err) {
    console.error('Generate module content error:', err);
    res.status(500).json({ message: err.message || 'Generation failed' });
  }
});

// ── LEAD FINDER ACTIONS ──

router.post('/leads/generate-strategy', async (req, res) => {
  try {
    const { sector_id, target_profile, campaign_goal } = req.body;
    let sectorName = 'General';
    if (sector_id) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [sector_id]);
      sectorName = rows[0]?.name || 'General';
    }
    const strategy = await generateOutreachStrategy(sectorName, target_profile, campaign_goal);
    res.json(strategy);
  } catch (err) {
    console.error('Generate strategy error:', err);
    res.status(500).json({ message: err.message || 'Generation failed' });
  }
});

router.post('/leads/draft-email', async (req, res) => {
  try {
    const { contact_id, campaign_goal } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });
    const { rows } = await pool.query(
      `SELECT c.*, o.name AS org_name, s.name AS sector_name FROM contacts c
       LEFT JOIN organisations o ON c.organisation_id = o.id
       LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1`, [contact_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Contact not found' });
    const contact = rows[0];
    const draft = await draftColdEmail(
      `${contact.first_name} ${contact.last_name}`, contact.job_title,
      contact.org_name, contact.sector_name, campaign_goal
    );
    res.json(draft);
  } catch (err) {
    console.error('Draft email error:', err);
    res.status(500).json({ message: err.message || 'Draft failed' });
  }
});

router.post('/leads/draft-linkedin', async (req, res) => {
  try {
    const { contact_id, message_context } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });
    const { rows } = await pool.query(
      `SELECT c.*, o.name AS org_name, s.name AS sector_name FROM contacts c
       LEFT JOIN organisations o ON c.organisation_id = o.id
       LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1`, [contact_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Contact not found' });
    const contact = rows[0];
    const message = await draftLinkedInMessage(
      `${contact.first_name} ${contact.last_name}`, contact.job_title,
      contact.org_name, contact.sector_name, message_context
    );
    res.json({ message, contact_name: `${contact.first_name} ${contact.last_name}` });
  } catch (err) {
    console.error('Draft LinkedIn error:', err);
    res.status(500).json({ message: err.message || 'Draft failed' });
  }
});

router.post('/leads/suggest-targets', async (req, res) => {
  try {
    const { sector_id, ideal_client } = req.body;
    let sectorName = 'General';
    if (sector_id) {
      const { rows } = await pool.query('SELECT name FROM sectors WHERE id = $1', [sector_id]);
      sectorName = rows[0]?.name || 'General';
    }
    const suggestions = await suggestLeadTargets(sectorName, ideal_client);
    res.json({ suggestions });
  } catch (err) {
    console.error('Suggest targets error:', err);
    res.status(500).json({ message: err.message || 'Suggestion failed' });
  }
});

// ── IMPLEMENTATION COACH ACTIONS ──

router.post('/coach/generate-followup-tasks', async (req, res) => {
  try {
    const { contact_id, course_id } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });

    const { rows: contacts } = await pool.query(
      'SELECT c.*, o.name AS org_name, o.type AS org_type FROM contacts c LEFT JOIN organisations o ON c.organisation_id = o.id WHERE c.id = $1', [contact_id]
    );
    if (contacts.length === 0) return res.status(404).json({ message: 'Contact not found' });
    const contact = contacts[0];
    const org = { name: contact.org_name, type: contact.org_type };

    let course = null;
    if (course_id) {
      const { rows } = await pool.query('SELECT c.*, s.name AS sector_name FROM courses c LEFT JOIN sectors s ON c.sector_id = s.id WHERE c.id = $1', [course_id]);
      course = rows[0];
    }

    const { rows: completedTasks } = await pool.query(
      "SELECT title, review_score FROM learning_tasks WHERE contact_id = $1 AND status = 'approved' ORDER BY approved_at DESC LIMIT 10",
      [contact_id]
    );

    const tasks = await generateFollowUpTasks(contact, org, completedTasks, course);

    // Save tasks
    const savedIds = [];
    for (const t of tasks) {
      const { rows: [saved] } = await pool.query(
        `INSERT INTO learning_tasks (contact_id, title, description, task_type, difficulty, status)
         VALUES ($1, $2, $3, $4, $5, 'assigned') RETURNING id`,
        [contact_id, t.title, t.description, t.task_type || 'deliverable', t.difficulty || 'intermediate']
      );
      savedIds.push(saved.id);
    }

    res.json({ tasks, saved_count: savedIds.length });
  } catch (err) {
    console.error('Generate follow-up tasks error:', err);
    res.status(500).json({ message: err.message || 'Generation failed' });
  }
});

router.post('/coach/send-nudge', async (req, res) => {
  try {
    const { contact_id } = req.body;
    if (!contact_id) return res.status(400).json({ message: 'contact_id required' });

    const { rows: contacts } = await pool.query(
      'SELECT c.*, o.name AS org_name FROM contacts c LEFT JOIN organisations o ON c.organisation_id = o.id WHERE c.id = $1', [contact_id]
    );
    if (contacts.length === 0) return res.status(404).json({ message: 'Contact not found' });
    const contact = contacts[0];
    if (!contact.email) return res.status(400).json({ message: 'Contact has no email address' });

    // Get stalled tasks
    const { rows: stalledTasks } = await pool.query(
      "SELECT title FROM learning_tasks WHERE contact_id = $1 AND status = 'assigned' ORDER BY created_at",
      [contact_id]
    );

    // Calculate days since last activity
    const { rows: journey } = await pool.query(
      'SELECT last_activity_at FROM learning_journeys WHERE contact_id = $1 LIMIT 1', [contact_id]
    );
    const lastActivity = journey[0]?.last_activity_at;
    const daysSince = lastActivity ? Math.floor((Date.now() - new Date(lastActivity)) / 86400000) : 30;

    // Draft nudge
    const draft = await draftNudgeEmail(contact, { name: contact.org_name }, stalledTasks, daysSince);

    // Send
    const gmailResult = await sendEmail(contact.email, draft.subject, draft.body);

    // Track
    await pool.query(
      `INSERT INTO outreach_messages (contact_id, channel, subject, body, status, sent_at, gmail_message_id)
       VALUES ($1, 'nudge_email', $2, $3, 'sent', NOW(), $4)`,
      [contact_id, draft.subject, draft.body, gmailResult?.id || null]
    );

    await pool.query('UPDATE contacts SET last_contacted_at = NOW() WHERE id = $1', [contact_id]);

    res.json({ sent: true, subject: draft.subject, to: contact.email });
  } catch (err) {
    console.error('Send nudge error:', err);
    res.status(500).json({ message: err.message || 'Send failed' });
  }
});

router.post('/coach/cohort-progress', async (req, res) => {
  try {
    const { cohort_id } = req.body;
    if (!cohort_id) return res.status(400).json({ message: 'cohort_id required' });

    const { rows: cohorts } = await pool.query(
      `SELECT c.name, co.name AS client_name FROM cohorts c
       LEFT JOIN organisations co ON c.client_organisation_id = co.id WHERE c.id = $1`, [cohort_id]
    );
    if (cohorts.length === 0) return res.status(404).json({ message: 'Cohort not found' });

    // Get orgs in this cohort
    const { rows: cohortOrgs } = await pool.query(
      'SELECT organisation_id FROM cohort_organisations WHERE cohort_id = $1', [cohort_id]
    );
    const orgIds = cohortOrgs.map(o => o.organisation_id);

    // Get journeys for contacts in those orgs
    const { rows: journeys } = await pool.query(
      `SELECT lj.*, ct.first_name, ct.last_name, o.name AS org_name
       FROM learning_journeys lj
       LEFT JOIN contacts ct ON lj.contact_id = ct.id
       LEFT JOIN organisations o ON lj.organisation_id = o.id
       WHERE lj.organisation_id = ANY($1)
       ORDER BY lj.overall_progress DESC`,
      [orgIds.length > 0 ? orgIds : [null]]
    );

    const report = await assessCohortProgress(cohorts[0].name, cohorts[0].client_name, journeys);
    res.json({ report, journeys_count: journeys.length });
  } catch (err) {
    console.error('Cohort progress error:', err);
    res.status(500).json({ message: err.message || 'Assessment failed' });
  }
});

// Lead Miner — mine Gmail with options
router.post('/leads/mine-gmail', async (req, res) => {
  try {
    const { mode, keywords } = req.body; // mode: 'recent' | 'deep', keywords: string
    // Start async — return immediately
    res.json({ message: 'Mining started', mode: mode || 'recent' });

    // Import and run
    const { runLeadMinerAdvanced } = await import('../services/background-jobs.js');
    const result = await runLeadMinerAdvanced(mode || 'recent', keywords || '');

    // Update job record
    await pool.query(
      `UPDATE background_jobs SET last_run_at = NOW(), last_status = 'success', last_items_processed = $1 WHERE name = 'lead_miner'`,
      [result.itemsProcessed]
    );

    // Create notification
    if (result.itemsProcessed > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body) VALUES ($1, 'lead_miner', $2, $3)`,
        [req.user.id, `Lead Miner found ${result.itemsProcessed} new leads`, result.result?.slice(0, 500)]
      );
    }
  } catch (err) {
    console.error('Lead mine error:', err);
    await pool.query(
      `UPDATE background_jobs SET last_run_at = NOW(), last_status = 'error', last_error = $1 WHERE name = 'lead_miner'`,
      [err.message]
    ).catch(() => {});
  }
});

export default router;
