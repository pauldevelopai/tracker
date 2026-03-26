import { Router } from 'express';
import pool from '../db/pool.js';
import { runJobNow, reloadScheduler } from '../services/scheduler.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT bj.*,
        (SELECT count(*)::int FROM job_runs jr WHERE jr.job_id = bj.id) AS total_runs,
        (SELECT status FROM job_runs jr WHERE jr.job_id = bj.id ORDER BY started_at DESC LIMIT 1) AS last_status
      FROM background_jobs bj ORDER BY bj.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { is_enabled, cron_expression } = req.body;
    const { rows } = await pool.query(
      `UPDATE background_jobs SET
        is_enabled = COALESCE($1, is_enabled),
        cron_expression = COALESCE($2, cron_expression),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [is_enabled, cron_expression, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Job not found' });

    // Reload scheduler to pick up changes
    await reloadScheduler();
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    // Run asynchronously — return immediately
    res.json({ message: 'Job started' });
    await runJobNow(req.params.id);
  } catch (err) {
    console.error('Manual job run error:', err);
  }
});

router.get('/:id/runs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM job_runs WHERE job_id = $1 ORDER BY started_at DESC LIMIT 20',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/runs/:runId', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM job_runs WHERE id = $1', [req.params.runId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Run not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
