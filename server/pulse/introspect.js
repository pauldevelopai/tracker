// Assemble a token-budgeted summary of a node's code for the AI prompts.
// Reads from GitHub (see github.js). Priority order mirrors the Phase 0 finding:
// package.json → index.js → lib/handlers.js → lib/schema.js → README → other
// lib/* by size → CLAUDE.md. Everything is best-effort: a missing file or a
// GitHub hiccup degrades the summary, never throws the whole cycle.
import { resolveRepo, getFile, listDir } from './github.js';

const DEFAULT_BUDGET = 16000; // ~chars of source fed to the model

function clip(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

// Returns { repo, version, runtimeVersion, summary } where summary is a single
// string of labelled file excerpts ready to drop into a prompt.
export async function assembleNodeContext(slug, { budget = DEFAULT_BUDGET } = {}) {
  const repo = resolveRepo(slug);
  const result = { slug, repo, version: null, runtimeVersion: null, summary: '' };
  if (!repo) return result;

  const parts = [];
  let spent = 0;
  const add = (label, text, max) => {
    if (!text) return;
    const body = clip(text, Math.min(max, Math.max(0, budget - spent)));
    if (!body) return;
    parts.push(`### ${label}\n${body}`);
    spent += body.length;
  };

  // package.json (also yields versions)
  try {
    const pkgRaw = await getFile(repo, 'package.json');
    if (pkgRaw) {
      add('package.json', pkgRaw, 1500);
      try {
        const pkg = JSON.parse(pkgRaw);
        result.version = pkg.version || null;
        const dep = (pkg.dependencies && pkg.dependencies['@developai/grounded-node-runtime']) || '';
        const m = String(dep).match(/v?\d+\.\d+\.\d+/);
        result.runtimeVersion = m ? m[0] : null;
      } catch { /* leave versions null */ }
    }
  } catch { /* skip */ }

  // entry + README + CLAUDE.md (best-effort)
  for (const [label, path, max] of [
    ['index.js', 'index.js', 4000],
    ['lib/handlers.js', 'lib/handlers.js', 5000],
    ['lib/schema.js', 'lib/schema.js', 1500],
    ['README.md', 'README.md', 4000],
    ['CLAUDE.md', 'CLAUDE.md', 2000],
  ]) {
    if (spent >= budget) break;
    try { add(label, await getFile(repo, path), max); } catch { /* skip */ }
  }

  // Remaining lib/* modules, largest first, until budget exhausted.
  try {
    const libs = (await listDir(repo, 'lib'))
      .filter((f) => f.type === 'file' && f.name.endsWith('.js') &&
        !['handlers.js', 'schema.js'].includes(f.name))
      .sort((a, b) => (b.size || 0) - (a.size || 0));
    for (const f of libs) {
      if (spent >= budget) break;
      try { add(`lib/${f.name}`, await getFile(repo, f.path), 2500); } catch { /* skip */ }
    }
  } catch { /* no lib dir */ }

  result.summary = parts.join('\n\n') || '(no source could be read from the repo)';
  return result;
}
