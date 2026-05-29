// Pulse — public (unauthenticated) routes, mounted under /api/pulse/public and
// gated only by requirePulse. These are the newsroom-facing endpoints: they
// validate the cycle token and return ONLY public-safe data (never admin fields).
import { Router } from 'express';
import config from '../config.js';
import * as at from '../pulse/airtable.js';
import { TABLES } from '../pulse/airtable.js';
import { shortId } from '../pulse/ids.js';

const router = Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error('[pulse-public]', err);
  res.status(500).json({ message: 'Something went wrong' });
});

function nodeUrl(slug) {
  return slug ? `${config.publicBaseUrl}/nodes/${slug}/app/` : config.publicBaseUrl;
}

// Load the cycle for a token, returning only the questions (labels, no scoring
// values) the newsroom needs to answer.
router.get('/cycle/:token', wrap(async (req, res) => {
  const cycle = await at.cycleByToken(req.params.token);
  if (!cycle) return res.status(404).json({ message: 'This link is not valid.' });
  const f = cycle.fields || {};
  const status = f.Status?.name || f.Status;
  const alreadySubmitted = status === 'Responded' || status === 'Plan drafted' ||
    status === 'Plan approved' || status === 'Shipped' || status === 'Reported back';

  const questions = [];
  for (const qid of (f.Questions || [])) {
    try {
      const q = await at.getRecord(TABLES.QUESTIONS, qid);
      const qf = q.fields || {};
      questions.push({
        order: qf.Order || 0,
        text: qf['Question text'] || '',
        options: ['A', 'B', 'C', 'D']
          .filter((L) => qf[`Option ${L}`])
          .map((L) => ({ key: L, label: qf[`Option ${L}`] })),
      });
    } catch { /* skip */ }
  }
  questions.sort((a, b) => a.order - b.order);

  res.json({
    cycleId: cycle.id,
    newsroom: f.Newsroom || '',
    alreadySubmitted,
    questions,
  });
}));

// Accept a submission. Writes a Response, links it, sets the cycle to Responded,
// returns the AI tip + a CTA link to the newsroom's node.
router.post('/submit', wrap(async (req, res) => {
  const { token, answers, openFeedback, name, role } = req.body || {};
  const cycle = await at.cycleByToken(token);
  if (!cycle) return res.status(404).json({ message: 'This link is not valid.' });
  const f = cycle.fields || {};
  const status = f.Status?.name || f.Status;
  if (status !== 'Sent') {
    return res.status(409).json({ message: 'This check-in has already been submitted. Thank you!' });
  }

  const a = Array.isArray(answers) ? answers : [answers?.[0], answers?.[1], answers?.[2]];
  const response = await at.createRecord(TABLES.RESPONSES, {
    'Response ID': shortId('RESP'),
    Cycle: [cycle.id],
    'Submitted at': new Date().toISOString(),
    'Answer 1': a[0] != null ? String(a[0]) : '',
    'Answer 2': a[1] != null ? String(a[1]) : '',
    'Answer 3': a[2] != null ? String(a[2]) : '',
    'Open feedback': openFeedback || '',
    'AI tip sent': f['AI tip'] || '',
    'Raw payload': JSON.stringify(req.body || {}),
    'Respondent name': name || '',
    'Respondent role': role || '',
  });
  await at.updateRecord(TABLES.CYCLES, cycle.id, { Status: 'Responded' });

  res.json({
    ok: true,
    tip: f['AI tip'] || '',
    nodeUrl: nodeUrl(f['Node Install']),
    responseId: response.id,
  });
}));

export default router;
