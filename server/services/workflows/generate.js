// "Describe & build" — one Claude call drafts a valid workflow graph from a
// plain-English description, given the live block registry. The output is
// validated against the registry before return. Ported from the GROUNDED platform.
import blocks from '../blocks/registry.js';
import { callClaude } from '../claude.js';
import { validateDefinition } from './validate.js';

const SYSTEM = `You design GROUNDED workflows by composing BLOCKS into a graph.
You are given a catalogue of available blocks (each with a slug, what it does, its
inputs and outputs). Compose the smallest graph that solves the user's request.

Rules:
- Use ONLY blocks from the catalogue, by their exact slug.
- A graph edge pipes one block's whole output into a downstream block's input
  field: { "from": { "node": "<id>", "field": "*" }, "to": { "node": "<id2>", "field": "<inputField>" } }.
- Any required input NOT fed by an edge must be a workflow input the user fills at
  run time: list it in "inputs" as { "name": "<short_name>", "to": { "node": "<id>", "field": "<inputField>" } }.
- "output" is the final block: { "node": "<id>", "field": "*" }.
- Give each node a short unique id like "n1", "n2".

Return ONLY a JSON object (no prose, no markdown fences):
{
  "name": "<short workflow name>",
  "definition": {
    "nodes":  [{ "id": "n1", "block": "<slug>", "config": {} }],
    "edges":  [{ "from": { "node": "n1", "field": "*" }, "to": { "node": "n2", "field": "<inputField>" } }],
    "inputs": [{ "name": "<short_name>", "to": { "node": "n1", "field": "<inputField>" } }],
    "output": { "node": "n2", "field": "*" }
  }
}`;

function parseJson(raw) {
  const s = String(raw == null ? '' : raw);
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Generator returned no JSON.');
  return JSON.parse(s.slice(a, b + 1));
}

export async function generateFromDescription({ description }) {
  if (!description || !String(description).trim()) throw new Error('Describe what you want the workflow to do.');
  const catalogue = blocks.list().filter((b) => !b.comingSoon).map((b) => ({
    slug: b.slug, name: b.name, category: b.category, description: b.description,
    inputs: b.inputs, outputs: b.outputs,
  }));

  const userContent = `# Available blocks\n${JSON.stringify(catalogue, null, 2)}\n\n# Request\n${description}\n\nCompose the workflow now. JSON only.`;
  const raw = await callClaude({ system: SYSTEM, userContent, maxTokens: 1800, temperature: 0.2 });

  let parsed;
  try { parsed = parseJson(raw); } catch (e) { throw new Error(`Couldn't parse the generated workflow: ${e.message}`); }
  if (!parsed.definition) throw new Error('Generated output had no definition.');

  const knownSlugs = new Set(catalogue.map((b) => b.slug));
  const v = validateDefinition(parsed.definition, knownSlugs);
  if (!v.ok) throw new Error(`Generated workflow was invalid: ${v.error}`);

  return { name: parsed.name || 'Untitled workflow', definition: parsed.definition };
}
