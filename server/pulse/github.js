// Fetch node source from GitHub at cycle time (decision: introspect over the
// network, no local checkout, so it works on the box too).
//
// Repo is resolved from the install slug by convention (node-<slug>), with an
// optional PULSE_NODE_REPOS JSON override for exceptions — node-agnostic, no
// node names hard-coded.
import config from '../config.js';

const GH = 'https://api.github.com';

function repoOverrides() {
  if (!config.pulseNodeRepos) return {};
  try { return JSON.parse(config.pulseNodeRepos); } catch { return {}; }
}

// slug → repo name. Convention: node-<slug>; already-prefixed slugs pass through.
export function resolveRepo(slug) {
  if (!slug) return null;
  const override = repoOverrides()[slug];
  if (override) return override;
  return slug.startsWith('node-') ? slug : `node-${slug}`;
}

async function gh(path, { raw = false } = {}) {
  if (!config.githubToken) throw new Error('GITHUB_TOKEN not configured');
  const res = await fetch(`${GH}${path}`, {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'User-Agent': 'grounded-pulse',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return raw ? res.text() : res.json();
}

// Raw text of a single file, or null if absent.
export async function getFile(repo, filePath) {
  return gh(`/repos/${config.githubOrg}/${repo}/contents/${filePath}`, { raw: true });
}

// Directory listing (array of {name, path, type, size}) or [] if absent.
export async function listDir(repo, dirPath) {
  const data = await gh(`/repos/${config.githubOrg}/${repo}/contents/${dirPath}`);
  return Array.isArray(data) ? data : [];
}
