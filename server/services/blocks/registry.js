// Block registry — the single source of "what can be dropped into a workflow".
//
// Every droppable building block registers here with the SAME shape, whether
// it's a Node (now), one of the 4 operations tools (next), or an agent (later).
// The Builder palette is just list(); the runner dispatches via get(slug).run().
//
//   slug, name, category('node'|'tool'|'agent'), icon, description,
//   inputs  { field:{type,required?,description?} },
//   outputs { field:{type,description?} },
//   config  { field:{type,default,label,...} },
//   comingSoon?  true → shown in palette but run() blocked,
//   run     async (input, ctx) => result   (ctx: { userId, authToken, origin })
//
// Block modules (nodes.js, tools.js, …) import { register } from here and call
// it at load. Trigger their registration with a side-effect import (e.g. the
// route does `import './blocks/nodes.js'`) — we do NOT import them here, to keep
// ESM module resolution acyclic.

const _registry = new Map();

export function register(entry) {
  const required = ['slug', 'name', 'inputs', 'outputs', 'run'];
  for (const k of required) {
    if (entry[k] === undefined) throw new Error(`blocks.register: missing "${k}"`);
  }
  if (_registry.has(entry.slug)) throw new Error(`blocks.register: duplicate slug "${entry.slug}"`);
  if (entry.category === undefined) entry.category = 'agent';
  if (!['node', 'tool', 'agent'].includes(entry.category)) throw new Error(`blocks.register: bad category "${entry.category}"`);
  if (entry.icon === undefined) entry.icon = '⚙️';
  if (entry.config === undefined) entry.config = {};
  if (entry.description === undefined) entry.description = '';
  if (entry.comingSoon === undefined) entry.comingSoon = false;
  _registry.set(entry.slug, entry);
  return entry;
}

export function resolveConfig(slug, supplied) {
  const b = _registry.get(slug);
  if (!b) return supplied || {};
  const out = { ...(supplied || {}) };
  for (const [k, schema] of Object.entries(b.config || {})) {
    if (out[k] === undefined || out[k] === '') out[k] = schema.default;
  }
  return out;
}

export function list() {
  return [..._registry.values()].map(({ run, ...meta }) => meta);
}
export function listByCategory(cat) {
  return list().filter((b) => b.category === cat);
}
export function get(slug) {
  return _registry.get(slug);
}

export default { register, resolveConfig, list, listByCategory, get };
