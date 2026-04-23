// Compare Ollama (Gemma 3 12B) triage output against Claude's past decisions.
//
// Picks 5 random items that were already triaged, runs them through the current
// classifier backend (whatever LLM_BACKEND points to — Ollama by default), and
// prints both results side-by-side. Doesn't write to the DB — read-only.
//
// Usage:
//   node server/db/scripts/test_ollama_triage.js            # default: Ollama
//   LLM_BACKEND=anthropic node ... test_ollama_triage.js    # compare against Claude live

import pool from '../../db/pool.js';
import { callClaudeClassifier } from '../../services/claude.js';

// Build a catalogue using short codes (L01, R01) instead of full UUIDs.
// Small models struggle to copy UUIDs verbatim and will often hallucinate a
// match. Short codes are easy to emit correctly; we map back to UUIDs in
// Node and reject anything that isn't in the map.
async function loadCatalogueBlock() {
  const { rows: lawsuits } = await pool.query(`
    SELECT id, case_name, jurisdiction,
           array_to_string(defendants, ', ') AS defendants_str
      FROM ai_lawsuits ORDER BY case_name
  `);
  const { rows: regs } = await pool.query(`
    SELECT id, regulation_name, short_name, jurisdiction
      FROM ai_regulations ORDER BY COALESCE(short_name, regulation_name)
  `);

  const codeToUuid = new Map();
  const lines = [];
  lines.push('## Lawsuits — use code for match_ref (e.g. L03)');
  lawsuits.forEach((l, i) => {
    const code = `L${String(i + 1).padStart(2, '0')}`;
    codeToUuid.set(code, { kind: 'lawsuit', id: l.id, name: l.case_name });
    lines.push(`${code} · ${l.case_name} · ${l.jurisdiction} · def: ${l.defendants_str || '—'}`);
  });
  lines.push('');
  lines.push('## Regulations — use code for match_ref (e.g. R05)');
  regs.forEach((r, i) => {
    const code = `R${String(i + 1).padStart(2, '0')}`;
    const label = r.short_name ? `${r.short_name} — ${r.regulation_name}` : r.regulation_name;
    codeToUuid.set(code, { kind: 'regulation', id: r.id, name: label });
    lines.push(`${code} · ${label} · ${r.jurisdiction}`);
  });
  return { block: lines.join('\n'), codeToUuid };
}

function buildPrompt(item, catalogueBlock) {
  return {
    system: `You are a legal-news triage agent for a tracker of AI lawsuits and regulations.

${catalogueBlock}

# Your task
Classify the news item. Pick ONE classification:
  - "event_on_lawsuit"           → a specific event in one of the lawsuits above (filing, ruling, settlement…)
  - "event_on_regulation"        → a specific event for one of the regulations above (enactment, guidance issued, enforcement action…)
  - "new_lawsuit_candidate"      → a NEW AI lawsuit not in the catalogue (human reviews before adding)
  - "new_regulation_candidate"   → a NEW AI regulation not in the catalogue
  - "use_case_candidate"         → a specific lawyer/firm using AI (newsworthy deployment)
  - "noise"                      → anything else: general AI news, non-legal tech news, opinion pieces, events announcements, etc.

# Strict rules
- If you classify as "event_on_lawsuit" or "event_on_regulation", match_ref MUST be one of the two-letter-plus-digits codes from the catalogue above (e.g. "L12", "R07"). Do NOT invent codes.
- If no code in the catalogue matches, classification is either "noise" or one of the "_candidate" types. Do NOT force a match.
- Tangentially related stories (e.g. a GDPR story vaguely related to AI) are NOISE, not "event_on_regulation", unless the story explicitly names a regulation in the catalogue.
- Output JSON ONLY. No preamble, no markdown.

# JSON output schema
{
  "classification": "one of the six values above",
  "match_ref": "L## or R## or null",
  "confidence": 0.0 to 1.0,
  "reason": "one short sentence"
}

# Examples

Example 1 (noise):
Input: "New survey: 62% of enterprises plan to increase AI spending in 2026."
Output: {"classification":"noise","match_ref":null,"confidence":0.95,"reason":"General AI business news with no legal actor or event."}

Example 2 (event on a known lawsuit):
Input: "Judge Gonzalez Rogers sets case management conference in Hendrix v. Apple for May 11, 2026."
Output: {"classification":"event_on_lawsuit","match_ref":"L21","confidence":0.95,"reason":"Scheduled hearing in a catalogued case."}

Example 3 (use case candidate):
Input: "Allen & Overy rolls out Harvey AI to all 3,500 lawyers globally after 6-month pilot."
Output: {"classification":"use_case_candidate","match_ref":null,"confidence":0.9,"reason":"Specific law firm deploying AI at scale."}

Example 4 (tangential — NOT an event on a regulation):
Input: "EDPB issues opinion on Meta's 'Pay or Okay' consent model under GDPR."
Output: {"classification":"noise","match_ref":null,"confidence":0.85,"reason":"GDPR consent opinion with no AI-specific regulation in catalogue referenced."}`,
    userContent: `Title: ${item.title || '(no title)'}
URL: ${item.url || '(no url)'}
Published: ${item.published_at ? new Date(item.published_at).toISOString().slice(0, 10) : 'unknown'}

Content:
${(item.content || '').slice(0, 1500)}

Classify and output JSON.`,
  };
}

async function main() {
  const backend = process.env.LLM_BACKEND || 'ollama';
  console.log(`── Classifier test: backend=${backend} ──\n`);

  const { block: catalogue, codeToUuid } = await loadCatalogueBlock();

  // Sample from the full DB, not just noise — we want to see if Gemma can
  // catch the signal that Claude caught (promoted + classified items) AND
  // stay silent on the noise.
  const { rows: items } = await pool.query(
    `SELECT id, title, url, content, published_at, triage_status, triage_result
       FROM ai_legal_raw_items
      WHERE triage_status IN ('rejected', 'classified', 'promoted')
        AND content IS NOT NULL
        AND length(content) > 200
      ORDER BY random() LIMIT 8`
  );

  const agreements = { same_class: 0, hallucinated: 0 };
  const rows = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prev = item.triage_result || {};
    const p = buildPrompt(item, catalogue);
    const t0 = Date.now();
    let result = null, err = null, resolvedMatch = null;
    try {
      const raw = await callClaudeClassifier({
        cachedSystem: p.system,
        userContent: p.userContent,
        maxTokens: 300,
        temperature: 0,
      });
      const match = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : raw);
      // Resolve match_ref → entity. Unknown code = rejected.
      if (result.match_ref) {
        const entry = codeToUuid.get(String(result.match_ref).trim());
        if (entry) resolvedMatch = entry;
        else result.hallucinated_code = result.match_ref;
      }
    } catch (e) {
      err = e.message;
    }
    const ms = Date.now() - t0;

    const prevClass = prev.classification || (item.triage_status === 'rejected' ? 'noise' : item.triage_status);
    const newClass = result?.classification;
    if (prevClass === newClass) agreements.same_class++;
    if (result?.hallucinated_code) agreements.hallucinated++;

    console.log(`─── Item ${i + 1} (${ms}ms) ───`);
    console.log(`  Title: ${(item.title || '').slice(0, 100)}`);
    console.log(`  DB status:    ${item.triage_status}  (prior: ${prevClass})`);
    if (err) {
      console.log(`  ${backend}: ERROR — ${err}`);
    } else {
      const matchInfo = resolvedMatch
        ? `${resolvedMatch.kind}:${result.match_ref} → ${resolvedMatch.name}`
        : result?.hallucinated_code
          ? `HALLUCINATED CODE (${result.hallucinated_code} — not in catalogue)`
          : '—';
      console.log(`  ${backend}: ${newClass} · conf=${result?.confidence} · match=${matchInfo}`);
      console.log(`  reason: ${(result?.reason || '').slice(0, 150)}`);
    }
    rows.push({ item_id: item.id, ms, prior: prevClass, new: newClass, err, hallucinated: !!result?.hallucinated_code });
    console.log('');
  }

  console.log('── Summary ──');
  console.log(`Classification agreement with prior run: ${agreements.same_class}/${items.length}`);
  console.log(`Hallucinated match codes:                ${agreements.hallucinated}/${items.length}`);
  console.log(`Errors:                                  ${rows.filter(r => r.err).length}/${items.length}`);
  console.log(`Avg latency: ${Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length)}ms`);

  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err);
  await pool.end();
  process.exit(1);
});
