// Pulse — admin routes (mounted under /api/pulse, gated by requirePulse +
// requireAuth + requireRole('admin')). Public answer routes live in
// pulse-public.js. Additive: nothing here touches existing tracker surfaces.
import { Router } from 'express';
import config from '../config.js';
import * as at from '../pulse/airtable.js';
import { TABLES } from '../pulse/airtable.js';
import { assembleNodeContext } from '../pulse/introspect.js';
import { matchNewsroom } from '../pulse/newsroom-match.js';
import { shortId, publicToken } from '../pulse/ids.js';
import * as gen from '../pulse/generate.js';
import * as fmt from '../pulse/format.js';

const router = Router();

const BLOCKING = {
  Draft:           'Vet questions',
  Vetted:          'Generate send copy',
  Sent:            'Awaiting newsroom',
  Responded:       'Draft plan',
  'Plan drafted':  'Approve plan',
  'Plan approved': 'Run Claude Code & mark shipped',
  Shipped:         'Send report',
  'Reported back': '—',
  Cancelled:       '—',
};

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error('[pulse]', err);
  res.status(500).json({ message: err.message || 'Pulse error' });
});

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// Resolve a cycle into a UI-friendly object with its linked questions/response/plan.
async function serializeCycle(cycle) {
  const f = cycle.fields || {};
  const questionIds = f.Questions || [];
  const questions = [];
  for (const id of questionIds) {
    try { questions.push(await at.getRecord(TABLES.QUESTIONS, id)); } catch { /* skip */ }
  }
  questions.sort((a, b) => (a.fields?.Order || 0) - (b.fields?.Order || 0));
  let response = null;
  if (f.Response?.[0]) { try { response = await at.getRecord(TABLES.RESPONSES, f.Response[0]); } catch { /* */ } }
  let plan = null;
  if (f['Change Plan']?.[0]) { try { plan = await at.getRecord(TABLES.PLANS, f['Change Plan'][0]); } catch { /* */ } }
  return {
    id: cycle.id,
    fields: f,
    status: f.Status?.name || f.Status || null,
    blocking: BLOCKING[f.Status?.name || f.Status] || '—',
    daysSinceUpdate: daysSince(cycle.createdTime),
    questions: questions.map((q) => ({ id: q.id, fields: q.fields })),
    response: response ? { id: response.id, fields: response.fields } : null,
    plan: plan ? { id: plan.id, fields: plan.fields } : null,
  };
}

// ── Context lookups for the trigger UI ──────────────────────────────────────
router.get('/newsrooms', wrap(async (req, res) => {
  const rooms = await at.listNewsrooms();
  res.json(rooms.map((r) => ({
    id: r.id,
    name: r.fields?.Name || '',
    country: r.fields?.Country?.name || r.fields?.Country || '',
    type: r.fields?.Type?.name || r.fields?.Type || '',
    cohort: r.fields?.['Cohort Name']?.name || r.fields?.['Cohort Name'] || '',
  })));
}));

// Node installs, each with fuzzy newsroom-match candidates (Paul confirms).
router.get('/node-installs', wrap(async (req, res) => {
  const [installs, newsrooms] = await Promise.all([at.listNodeInstalls(), at.listNewsrooms()]);
  res.json(installs.map((i) => {
    const f = i.fields || {};
    return {
      id: i.id,
      slug: f.slug || '',
      newsroom: f.newsroom || '',
      nodeVersion: f.node_version || '',
      runtimeVersion: f.runtime_version || '',
      platform: f.platform || '',
      lastSeen: f.last_seen || '',
      bootCount: f.boot_count || 0,
      newsroomMatches: matchNewsroom(f.newsroom, newsrooms),
    };
  }));
}));

router.get('/tags', wrap(async (req, res) => {
  res.json({ tags: await at.tagLibrary() });
}));

// ── Cycles ──────────────────────────────────────────────────────────────────
// Create a cycle: gather context, generate 3 MCQs + tip, write Cycle + Questions.
router.post('/cycles', wrap(async (req, res) => {
  const { newsroomId, newsroomName, nodeInstallId, nodeSlug } = req.body || {};

  // Resolve newsroom (record id wins; else fuzzy-match the name).
  let newsroom = null;
  if (newsroomId) {
    newsroom = await at.getRecord(TABLES.NEWSROOMS, newsroomId);
  } else if (newsroomName) {
    const candidates = matchNewsroom(newsroomName, await at.listNewsrooms());
    if (candidates[0]) newsroom = await at.getRecord(TABLES.NEWSROOMS, candidates[0].id);
  }
  if (!newsroom) return res.status(400).json({ message: 'Could not resolve a newsroom (pass newsroomId or a matchable newsroomName)' });

  // Resolve node install + slug.
  let install = null;
  if (nodeInstallId) { try { install = await at.getRecord(TABLES.NODE_INSTALLS, nodeInstallId); } catch { /* */ } }
  const slug = (install?.fields?.slug) || nodeSlug;
  if (!slug) return res.status(400).json({ message: 'Could not resolve a node slug (pass nodeInstallId or nodeSlug)' });

  // Context (all best-effort except the node code which drives the questions).
  const node = await assembleNodeContext(slug);
  const [priorResponses, nodeEvents, tags] = await Promise.all([
    at.priorResponsesForNewsroom(newsroom.id).catch(() => []),
    at.recentNodeEvents(slug).catch(() => []),
    at.tagLibrary().catch(() => []),
  ]);

  const generated = await gen.generateQuestions({
    newsroom: fmt.formatNewsroom(newsroom),
    slug,
    repo: node.repo || '',
    version: node.version || install?.fields?.node_version || '',
    nodeCode: node.summary,
    nodeEvents: fmt.formatNodeEvents(nodeEvents),
    priorResponses: fmt.formatPriorResponses(priorResponses),
    tagLibrary: tags.join(', ') || '(none yet)',
  });

  const today = new Date().toISOString().slice(0, 10);
  const cycle = await at.createRecord(TABLES.CYCLES, {
    'Cycle ID': shortId('CYC'),
    Newsroom: newsroom.fields?.Name || newsroomName || '',
    'Newsroom record ID': newsroom.id,
    'Node Install': slug,
    'Node Install record ID': install?.id || '',
    'Triggered date': today,
    Status: 'Draft',
    'Node version before': node.version || install?.fields?.node_version || '',
    'AI tip': generated.tip || '',
  });

  // Create questions, linked back to the cycle (symmetric link sets Cycle.Questions).
  const qRecords = (generated.questions || []).slice(0, 3).map((q, idx) => {
    const o = q.options || [];
    const fields = {
      'Question ID': shortId('Q'),
      Cycle: [cycle.id],
      Order: q.order || idx + 1,
      'Question text': q.text || '',
      Tag: q.tag || undefined,
      Rationale: q.rationale || '',
    };
    ['A', 'B', 'C', 'D'].forEach((L, i) => {
      if (o[i]) { fields[`Option ${L}`] = o[i].label || ''; fields[`Option ${L} value`] = o[i].value ?? null; }
    });
    return fields;
  });
  if (qRecords.length) await at.createRecords(TABLES.QUESTIONS, qRecords);

  const fresh = await at.getRecord(TABLES.CYCLES, cycle.id);
  res.status(201).json(await serializeCycle(fresh));
}));

// List cycles, filterable by newsroom (record id) and status.
router.get('/cycles', wrap(async (req, res) => {
  const { newsroom, status } = req.query;
  const clauses = [];
  if (newsroom) clauses.push(`{Newsroom record ID} = '${String(newsroom).replace(/'/g, '')}'`);
  if (status) clauses.push(`{Status} = '${String(status).replace(/'/g, '')}'`);
  const filterByFormula = clauses.length ? (clauses.length > 1 ? `AND(${clauses.join(',')})` : clauses[0]) : undefined;
  const cycles = await at.listAll(TABLES.CYCLES, { filterByFormula });
  // Light list (no per-cycle link fan-out) for the overview table.
  res.json(cycles.map((c) => {
    const f = c.fields || {};
    const st = f.Status?.name || f.Status || null;
    return {
      id: c.id,
      cycleId: f['Cycle ID'] || '',
      newsroom: f.Newsroom || '',
      newsroomRecordId: f['Newsroom record ID'] || '',
      nodeInstall: f['Node Install'] || '',
      status: st,
      blocking: BLOCKING[st] || '—',
      triggeredDate: f['Triggered date'] || '',
      daysSinceUpdate: daysSince(c.createdTime),
      publicUrl: f['Public URL'] || '',
    };
  }));
}));

router.get('/cycles/:id', wrap(async (req, res) => {
  const cycle = await at.getRecord(TABLES.CYCLES, req.params.id);
  res.json(await serializeCycle(cycle));
}));

// Safe partial update of a cycle (only Notes + AI tip editable here).
router.patch('/cycles/:id', wrap(async (req, res) => {
  const fields = {};
  if (typeof req.body?.notes === 'string') fields.Notes = req.body.notes;
  if (typeof req.body?.tip === 'string') fields['AI tip'] = req.body.tip;
  if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to update' });
  const updated = await at.updateRecord(TABLES.CYCLES, req.params.id, fields);
  res.json(await serializeCycle(updated));
}));

// ── Questions ────────────────────────────────────────────────────────────────
// Vetting edit: preserves the original wording the first time Paul changes it.
router.patch('/questions/:id', wrap(async (req, res) => {
  const current = await at.getRecord(TABLES.QUESTIONS, req.params.id);
  const cf = current.fields || {};
  const b = req.body || {};
  const fields = {};
  const map = {
    text: 'Question text', tag: 'Tag', rationale: 'Rationale', order: 'Order',
    optionA: 'Option A', optionAValue: 'Option A value',
    optionB: 'Option B', optionBValue: 'Option B value',
    optionC: 'Option C', optionCValue: 'Option C value',
    optionD: 'Option D', optionDValue: 'Option D value',
  };
  for (const [k, field] of Object.entries(map)) if (b[k] !== undefined) fields[field] = b[k];

  // Mark edited + preserve original question text once.
  if (b.text !== undefined && b.text !== cf['Question text']) {
    fields['Edited by Paul'] = true;
    if (!cf['Original question text']) fields['Original question text'] = cf['Question text'] || '';
  }
  if (b.vetted !== undefined) fields.Vetted = !!b.vetted;
  if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to update' });
  const updated = await at.updateRecord(TABLES.QUESTIONS, req.params.id, fields);
  res.json({ id: updated.id, fields: updated.fields });
}));

// ── Lifecycle transitions ─────────────────────────────────────────────────────
router.post('/cycles/:id/vet', wrap(async (req, res) => {
  // Optional final tip edit alongside vetting.
  if (typeof req.body?.tip === 'string') {
    await at.updateRecord(TABLES.CYCLES, req.params.id, { 'AI tip': req.body.tip });
  }
  // Mark all questions vetted.
  const cycle = await at.getRecord(TABLES.CYCLES, req.params.id);
  for (const qid of (cycle.fields?.Questions || [])) {
    try { await at.updateRecord(TABLES.QUESTIONS, qid, { Vetted: true }); } catch { /* */ }
  }
  const updated = await at.updateRecord(TABLES.CYCLES, req.params.id, { Status: 'Vetted' });
  res.json(await serializeCycle(updated));
}));

// Generate the public URL + copy-paste send bodies. Sets Status=Sent.
router.post('/cycles/:id/send', wrap(async (req, res) => {
  const cycle = await at.getRecord(TABLES.CYCLES, req.params.id);
  let publicUrl = cycle.fields?.['Public URL'];
  if (!publicUrl) {
    publicUrl = `${config.publicBaseUrl}/pulse/${publicToken()}`;
  }
  const updated = await at.updateRecord(TABLES.CYCLES, req.params.id, { Status: 'Sent', 'Public URL': publicUrl });
  const newsroom = cycle.fields?.Newsroom || 'there';
  const whatsapp = `Hi ${newsroom} 👋 Quick 2-minute Pulse check-in on your Grounded tool — 3 taps + anything you want to tell us. It directly shapes what we build next for you: ${publicUrl}`;
  const email = `Hi ${newsroom},\n\nIt's time for a quick Pulse check-in on your Grounded tool. It's 3 multiple-choice questions plus space to tell us anything — about two minutes, ideally on your phone.\n\nYour answers go straight into what we improve next for you:\n${publicUrl}\n\nThank you,\nThe Grounded / Develop AI team`;
  res.json({ cycle: await serializeCycle(updated), publicUrl, whatsapp, email });
}));

// Manual override: jump to Responded (rare).
router.post('/cycles/:id/mark-responded', wrap(async (req, res) => {
  const updated = await at.updateRecord(TABLES.CYCLES, req.params.id, { Status: 'Responded' });
  res.json(await serializeCycle(updated));
}));

// Draft a change plan from the response + node code.
router.post('/cycles/:id/draft-plan', wrap(async (req, res) => {
  const cycle = await at.getRecord(TABLES.CYCLES, req.params.id);
  const cf = cycle.fields || {};
  if (!cf.Response?.[0]) return res.status(400).json({ message: 'No response on this cycle yet' });
  const response = await at.getRecord(TABLES.RESPONSES, cf.Response[0]);

  const questions = [];
  for (const qid of (cf.Questions || [])) {
    try { questions.push(await at.getRecord(TABLES.QUESTIONS, qid)); } catch { /* */ }
  }
  questions.sort((a, b) => (a.fields?.Order || 0) - (b.fields?.Order || 0));

  const slug = cf['Node Install'];
  const node = await assembleNodeContext(slug);
  let newsroom = null;
  if (cf['Newsroom record ID']) { try { newsroom = await at.getRecord(TABLES.NEWSROOMS, cf['Newsroom record ID']); } catch { /* */ } }
  const priorResponses = await at.priorResponsesForNewsroom(cf['Newsroom record ID']).catch(() => []);

  // Election-sensitive note (Capital FM has elections Aug 2026, or any
  // elections-flagged install field).
  const electionish = /capital\s*fm/i.test(cf.Newsroom || '') ||
    JSON.stringify(cf).toLowerCase().includes('election');
  const electionNote = electionish
    ? 'NOTE: This newsroom (e.g. Capital FM) has elections in August 2026. Flag any change touching election-related functionality with Risk flag = "Election-sensitive".'
    : '';

  const plan = await gen.draftPlan({
    newsroom: fmt.formatNewsroom(newsroom),
    slug, repo: node.repo || '', version: node.version || '',
    nodeCode: node.summary,
    questions: fmt.formatQuestions(questions),
    response: fmt.formatResponse(response),
    priorResponses: fmt.formatPriorResponses(priorResponses),
    electionNote,
  });

  const planRec = await at.createRecord(TABLES.PLANS, {
    'Plan ID': shortId('PLAN'),
    Cycle: [cycle.id],
    'Drafted at': new Date().toISOString(),
    Summary: plan.noChange ? 'No change warranted' : (plan.summary || ''),
    Rationale: plan.rationale || '',
    Scope: plan.scope || '',
    'Risk flags': Array.isArray(plan.riskFlags) ? plan.riskFlags : [],
    Status: plan.noChange ? 'Rejected' : 'Drafted',
    'Rejection reason': plan.noChange ? (plan.rejectionReason || 'No change warranted by response') : '',
  });
  await at.updateRecord(TABLES.CYCLES, cycle.id, { Status: 'Plan drafted' });
  const fresh = await at.getRecord(TABLES.CYCLES, cycle.id);
  res.json({ cycle: await serializeCycle(fresh), plan: { id: planRec.id, fields: planRec.fields } });
}));

// ── Plans ─────────────────────────────────────────────────────────────────────
router.post('/plans/:id/approve', wrap(async (req, res) => {
  const plan = await at.getRecord(TABLES.PLANS, req.params.id);
  const pf = plan.fields || {};
  const cycleId = pf.Cycle?.[0];
  const cycle = cycleId ? await at.getRecord(TABLES.CYCLES, cycleId) : null;
  const slug = cycle?.fields?.['Node Install'];
  const node = slug ? await assembleNodeContext(slug) : { repo: '', version: '', summary: '' };

  const briefing = await gen.generateBriefing({
    summary: pf.Summary || '',
    rationale: pf.Rationale || '',
    scope: pf.Scope || '',
    riskFlags: (pf['Risk flags'] || []).map((r) => r.name || r).join(', '),
    slug: slug || '', repo: node.repo || '', org: config.githubOrg, version: node.version || '',
    nodeCode: node.summary,
  });

  const updatedPlan = await at.updateRecord(TABLES.PLANS, req.params.id, {
    Status: 'Approved',
    'Claude Code briefing prompt': briefing,
  });
  if (cycleId) await at.updateRecord(TABLES.CYCLES, cycleId, { Status: 'Plan approved' });
  res.json({ plan: { id: updatedPlan.id, fields: updatedPlan.fields }, briefing });
}));

router.post('/plans/:id/reject', wrap(async (req, res) => {
  const reason = req.body?.reason || '';
  const updated = await at.updateRecord(TABLES.PLANS, req.params.id, {
    Status: 'Rejected', 'Rejection reason': reason,
  });
  res.json({ plan: { id: updated.id, fields: updated.fields } });
}));

// Paul marks shipped after running Claude Code + committing.
router.post('/cycles/:id/mark-shipped', wrap(async (req, res) => {
  const { commitLink, nodeVersionAfter } = req.body || {};
  const cycle = await at.getRecord(TABLES.CYCLES, req.params.id);
  const fields = { Status: 'Shipped' };
  if (nodeVersionAfter) fields['Node version after'] = nodeVersionAfter;
  const updated = await at.updateRecord(TABLES.CYCLES, req.params.id, fields);
  // Stamp shipped details onto the plan if present.
  const planId = cycle.fields?.['Change Plan']?.[0];
  if (planId) {
    await at.updateRecord(TABLES.PLANS, planId, {
      Status: 'Shipped',
      'Shipped at': new Date().toISOString(),
      ...(commitLink ? { 'Commit/PR link': commitLink } : {}),
    });
  }
  res.json(await serializeCycle(updated));
}));

// Generate the report-back bodies. Sets Status=Reported back.
router.post('/cycles/:id/send-report', wrap(async (req, res) => {
  const cycle = await at.getRecord(TABLES.CYCLES, req.params.id);
  const cf = cycle.fields || {};
  let response = null, plan = null;
  if (cf.Response?.[0]) { try { response = await at.getRecord(TABLES.RESPONSES, cf.Response[0]); } catch { /* */ } }
  if (cf['Change Plan']?.[0]) { try { plan = await at.getRecord(TABLES.PLANS, cf['Change Plan'][0]); } catch { /* */ } }

  const report = await gen.generateReport({
    newsroom: cf.Newsroom || 'there',
    response: fmt.formatResponse(response),
    summary: plan?.fields?.Summary || '',
    rationale: plan?.fields?.Rationale || '',
    scope: plan?.fields?.Scope || '',
    slug: cf['Node Install'] || '',
    versionAfter: cf['Node version after'] || '',
  });

  const updated = await at.updateRecord(TABLES.CYCLES, req.params.id, { Status: 'Reported back' });
  res.json({ cycle: await serializeCycle(updated), ...report });
}));

export default router;
