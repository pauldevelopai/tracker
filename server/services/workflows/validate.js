// Validate a workflow definition against the block registry, so bad graphs
// (unknown blocks, dangling refs, cycles) are caught at the API boundary before
// the runner ever sees them. Ported from the GROUNDED platform.
import { topoSort } from './runner.js';

export function validateDefinition(def, knownSlugs) {
  if (!def || typeof def !== 'object') return { ok: false, error: 'definition must be an object' };
  const d = def;
  if (!Array.isArray(d.nodes)) return { ok: false, error: 'definition.nodes must be an array' };
  if (!Array.isArray(d.edges || [])) return { ok: false, error: 'definition.edges must be an array' };
  if (!Array.isArray(d.inputs || [])) return { ok: false, error: 'definition.inputs must be an array' };
  if (d.nodes.length === 0) return { ok: false, error: 'definition needs at least one block' };

  const nodeIds = new Set();
  for (const n of d.nodes) {
    if (!n || typeof n !== 'object') return { ok: false, error: 'each node must be an object' };
    if (typeof n.id !== 'string' || !n.id) return { ok: false, error: 'each node needs a non-empty string id' };
    if (nodeIds.has(n.id)) return { ok: false, error: `duplicate node id "${n.id}"` };
    nodeIds.add(n.id);
    const slug = n.block || n.agent || n.slug;
    if (!slug) return { ok: false, error: `node "${n.id}" is missing "block"` };
    if (knownSlugs && !knownSlugs.has(slug)) return { ok: false, error: `node "${n.id}" references unknown block "${slug}"` };
    if (n.config !== undefined && (typeof n.config !== 'object' || n.config === null)) {
      return { ok: false, error: `node "${n.id}" config must be an object` };
    }
  }

  for (const e of d.edges || []) {
    if (!e || !e.from || !e.to) return { ok: false, error: 'each edge needs from and to' };
    if (typeof e.from.node !== 'string' || typeof e.to.node !== 'string') return { ok: false, error: 'edge from/to need a node' };
    if (!nodeIds.has(e.from.node)) return { ok: false, error: `edge from unknown node "${e.from.node}"` };
    if (!nodeIds.has(e.to.node)) return { ok: false, error: `edge to unknown node "${e.to.node}"` };
  }

  for (const wi of d.inputs || []) {
    if (!wi || typeof wi.name !== 'string' || !wi.to || !nodeIds.has(wi.to.node)) {
      return { ok: false, error: 'each workflow input needs a name and a valid { to:{node,field} }' };
    }
  }

  if (d.output && d.output.node && !nodeIds.has(d.output.node)) {
    return { ok: false, error: `output references unknown node "${d.output.node}"` };
  }

  try { topoSort(d); } catch (err) { return { ok: false, error: err.message }; }
  return { ok: true };
}
