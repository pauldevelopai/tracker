// Nodes as workflow blocks.
//
// Each hosted Node exposes the runtime's standard /api/brief action (its primary
// AI step). A Node-block's run() calls that endpoint on the live hosted Node,
// forwarding the running user's session cookie so the Node's per-newsroom scoping
// + AI key apply. So "drop Election Watch into a workflow" === POST the step's
// input to /nodes/verifier/app/api/brief. Add a Node here = instantly droppable.
import { register } from './registry.js';

const COOKIE_NAME = process.env.AUTH_COOKIE || 'tracker_token';

function baseOrigin(ctx) {
  return (ctx && ctx.origin) || process.env.PUBLIC_BASE_URL || 'https://grounded.developai.co.za';
}

function nodeRunner(nodeSlug, endpoint = '/api/brief') {
  return async function run(input, ctx) {
    const url = `${baseOrigin(ctx)}/nodes/${nodeSlug}/app${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (ctx && ctx.authToken) headers.Cookie = `${COOKIE_NAME}=${ctx.authToken}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input || {}) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error(`Node "${nodeSlug}" ${endpoint} returned ${res.status}`);
      err.detail = data;
      throw err;
    }
    return data;
  };
}

// Election Watch (verifier)
register({
  slug: 'node-verifier',
  name: 'Election Watch — Verify a claim',
  category: 'node',
  icon: '🔎',
  description: 'Runs a suspect claim through the Election Watch node and returns a verification report.',
  inputs: {
    claimText: { type: 'longtext', required: true, description: 'The claim to verify.' },
    sourceUrl: { type: 'string', required: false, description: 'Optional source URL.' },
  },
  outputs: { report: { type: 'json', description: 'Verification report (tier, reasoning, checks, draft response).' } },
  run: nodeRunner('verifier'),
});

// Audience Signal (analytics)
register({
  slug: 'node-analytics',
  name: 'Audience Signal — Analyse',
  category: 'node',
  icon: '📊',
  description: 'Runs the Audience Signal node over the newsroom’s story performance and returns its analysis.',
  inputs: { input: { type: 'json', required: false, description: 'Payload passed to the node’s analysis step.' } },
  outputs: { result: { type: 'json', description: 'The node’s analysis output.' } },
  run: nodeRunner('analytics'),
});

// Podcast Studio — not hosted online yet → droppable placeholder.
register({
  slug: 'node-podcasting',
  name: 'Podcast Studio',
  category: 'node',
  icon: '🎙️',
  description: 'Turn a transcript into an AI-voiced podcast. (Runs locally today; online step coming soon.)',
  comingSoon: true,
  inputs: { transcript: { type: 'longtext', required: true, description: 'Transcript to voice.' } },
  outputs: { audio: { type: 'json', description: 'Generated audio reference.' } },
  run: async () => {
    const err = new Error('Podcast Studio is not hosted online yet — coming soon.');
    err.code = 'BLOCK_COMING_SOON';
    throw err;
  },
});
