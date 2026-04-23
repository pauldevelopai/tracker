// Empirically measure the Haiku + prompt-caching triage cost.
//
// Runs the real triage prompt on 3 already-rejected raw items back-to-back
// so we can observe:
//   - cache_creation_input_tokens on call 1
//   - cache_read_input_tokens on calls 2, 3
//   - input/output token split
//
// Then computes per-call cost in USD for Haiku 4.5 AND what the old path
// (Sonnet, no caching) would have cost, so we can compare.
//
// Cheap — ~3 × ~10k-input tokens Haiku ≈ $0.03 total spend.

import Anthropic from '@anthropic-ai/sdk';
import pool from '../../db/pool.js';
import config from '../../config.js';

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
// Reference pricing ($ per 1M tokens)
const PRICING = {
  haiku:  { input: 1.00, output: 5.00, cache_write: 1.25, cache_read: 0.10 },
  sonnet: { input: 3.00, output: 15.00 },
};

const client = new Anthropic({ apiKey: config.anthropicApiKey });

async function loadCatalogueBlock() {
  const { rows: lawsuits } = await pool.query(`
    SELECT id, case_name, jurisdiction, array_to_string(defendants, ', ') AS d
    FROM ai_lawsuits ORDER BY case_name
  `);
  const { rows: regs } = await pool.query(`
    SELECT id, regulation_name, short_name, jurisdiction
    FROM ai_regulations ORDER BY COALESCE(short_name, regulation_name)
  `);
  const lines = [];
  lines.push('## Known lawsuits');
  for (const l of lawsuits) lines.push(`- ${l.id} · ${l.case_name} · ${l.jurisdiction} · ${l.d || '—'}`);
  lines.push('## Known regulations');
  for (const r of regs) {
    const label = r.short_name ? `${r.short_name} — ${r.regulation_name}` : r.regulation_name;
    lines.push(`- ${r.id} · ${label} · ${r.jurisdiction}`);
  }
  return lines.join('\n');
}

async function pickSampleItems(n = 3) {
  const { rows } = await pool.query(
    `SELECT id, title, url, content, author, published_at
       FROM ai_legal_raw_items
      WHERE triage_status = 'rejected'
        AND content IS NOT NULL
        AND length(content) > 200
      ORDER BY random() LIMIT $1`,
    [n]
  );
  return rows;
}

function buildSystem(catalogueBlock) {
  return `You are a precise legal-news triage agent for an AI-legal tracker.

# Catalogue of known entities
${catalogueBlock}

Given one news item, output strict JSON:
{ "relevant": bool, "classification": "event_on_lawsuit"|"event_on_regulation"|"use_case_candidate"|"noise", "match_id": "<uuid>"|null, "confidence": 0.0-1.0 }
Output valid JSON only.`;
}

function buildUserContent(item) {
  return `**Title:** ${item.title || '(no title)'}
**URL:** ${item.url || '(no url)'}
**Source:** ${item.author || 'unknown'}
**Content:** ${(item.content || '').slice(0, 1500)}

Classify this item.`;
}

function costFor({ input, output, cache_creation, cache_read }, pricing) {
  const cost =
    (input          * pricing.input         / 1_000_000) +
    (output         * pricing.output        / 1_000_000) +
    (cache_creation * pricing.cache_write   / 1_000_000) +
    (cache_read     * pricing.cache_read    / 1_000_000);
  return cost;
}

function sonnetEquivalent(totalInput, output) {
  // Old path: Sonnet, no caching. So every call pays the full catalogue as regular input.
  return (totalInput * PRICING.sonnet.input / 1_000_000) +
         (output     * PRICING.sonnet.output / 1_000_000);
}

async function main() {
  console.log('── Triage cost verification ──');
  const catalogue = await loadCatalogueBlock();
  const system = buildSystem(catalogue);
  console.log(`System prompt: ${system.length} chars (~${Math.round(system.length / 4)} tokens)`);

  const items = await pickSampleItems(3);
  if (items.length < 3) {
    console.error('Not enough rejected items to sample. Need ≥3.');
    await pool.end();
    process.exit(1);
  }

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\nCall ${i + 1}: "${(item.title || '').slice(0, 60)}..."`);
    const t0 = Date.now();
    const resp = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      temperature: 0.1,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildUserContent(item) }],
    });
    const ms = Date.now() - t0;
    const u = resp.usage || {};
    const usage = {
      input:          u.input_tokens || 0,
      output:         u.output_tokens || 0,
      cache_creation: u.cache_creation_input_tokens || 0,
      cache_read:     u.cache_read_input_tokens || 0,
    };
    const haikuCost = costFor(usage, PRICING.haiku);
    // For the Sonnet-no-cache comparison: treat all cache tokens as plain input
    const sonnetCost = sonnetEquivalent(usage.input + usage.cache_creation + usage.cache_read, usage.output);
    console.log(`  ${ms}ms  input=${usage.input}  cache_write=${usage.cache_creation}  cache_read=${usage.cache_read}  output=${usage.output}`);
    console.log(`  Haiku+cache cost:  $${haikuCost.toFixed(6)}`);
    console.log(`  Sonnet no-cache:   $${sonnetCost.toFixed(6)}  (${((sonnetCost / haikuCost) || 0).toFixed(1)}× more expensive)`);
    results.push({ usage, haikuCost, sonnetCost, ms });
  }

  const totalHaiku  = results.reduce((a, r) => a + r.haikuCost,  0);
  const totalSonnet = results.reduce((a, r) => a + r.sonnetCost, 0);
  const avgPerCall  = totalHaiku / results.length;

  console.log('\n── Summary (3 calls) ──');
  console.log(`Total Haiku+cache cost:   $${totalHaiku.toFixed(6)}`);
  console.log(`Total Sonnet no-cache:    $${totalSonnet.toFixed(6)}`);
  console.log(`Savings:                  ${(100 * (1 - totalHaiku / totalSonnet)).toFixed(1)}%`);
  console.log(`Amortised per-call:       $${avgPerCall.toFixed(6)}`);

  // Extrapolate to realistic batch sizes. Note: after call 1 the cache is warm
  // for ~5 min, so all subsequent calls in a batch benefit. So amortised cost
  // scales roughly linearly with call 2+ cost, which is much lower than call 1.
  const call1  = results[0]?.haikuCost || 0;
  const laterAvg = results.slice(1).reduce((a, r) => a + r.haikuCost, 0) / Math.max(1, results.length - 1);
  console.log(`\nExtrapolation:`);
  console.log(`  Cold call (1):          $${call1.toFixed(6)}`);
  console.log(`  Warm calls (avg):       $${laterAvg.toFixed(6)}`);
  for (const n of [50, 100, 500]) {
    const projected = call1 + (n - 1) * laterAvg;
    console.log(`  ${n} items / batch:        $${projected.toFixed(4)}`);
  }

  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err.message);
  await pool.end();
  process.exit(1);
});
