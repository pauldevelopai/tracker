// Anthropic calls for the quality-critical Pulse steps. Reuses the tracker's
// Anthropic SDK + config.anthropicApiKey (see server/services/claude.js); Opus
// for generation/plan drafting per the brief. All calls are server-side.
import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';
import { loadPrompt, render } from './prompts.js';

// Current Opus string (brief said "claude-opus-4-7 or whatever the current Opus
// model string is" — that's claude-opus-4-8 as of this build).
const MODEL = process.env.PULSE_MODEL || 'claude-opus-4-8';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

async function complete(systemPrompt, { maxTokens = 4000 } = {}) {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  // NB: claude-opus-4-8 rejects `temperature` ("deprecated for this model"),
  // so we don't send it — the model picks its own.
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    // The whole rendered prompt is the system message; cache it so re-runs of
    // the same cycle (e.g. retries) are cheap.
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'Proceed.' }],
  });
  return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

// Tolerant JSON parse — strips ``` fences and grabs the outermost {...} if the
// model wrapped the object in prose despite instructions.
function parseJson(text) {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error(`Pulse: could not parse model JSON. Got: ${text.slice(0, 200)}`);
}

export async function generateQuestions(vars) {
  const out = await complete(render(loadPrompt('generate'), vars), { maxTokens: 3000 });
  return parseJson(out); // { questions: [...], tip: "..." }
}

export async function draftPlan(vars) {
  const out = await complete(render(loadPrompt('plan'), vars), { maxTokens: 3000 });
  return parseJson(out); // { noChange, summary, rationale, scope, riskFlags, rejectionReason }
}

export async function generateBriefing(vars) {
  // Plain text, not JSON.
  return complete(render(loadPrompt('claudecode-briefing'), vars), { maxTokens: 4000 });
}

export async function generateReport(vars) {
  const out = await complete(render(loadPrompt('report'), vars), { maxTokens: 1500 });
  return parseJson(out); // { subject, whatsapp, email }
}
