// Load Pulse prompt templates from server/pulse/prompts/*.md at runtime so they
// can be edited (and tuned) without redeploying. Cached after first read; call
// clearPromptCache() if you want to force a re-read in dev.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, 'prompts');
const cache = new Map();

// name is the file stem, e.g. 'generate' → prompts/generate.md
export function loadPrompt(name) {
  if (cache.has(name)) return cache.get(name);
  const text = readFileSync(join(DIR, `${name}.md`), 'utf8');
  cache.set(name, text);
  return text;
}

export function clearPromptCache() {
  cache.clear();
}

// Fill {{placeholders}} in a template with values from `vars`.
export function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}
