// Workflow runner — executes a `definition` graph against a runtime input map.
// Pure-ish: takes definition + inputs + ctx, returns { output, nodeOutputs }.
// No DB I/O (the route wraps this and records workflow_runs). Ported from the
// GROUNDED platform's lib/workflows/runner.js, adapted to the block registry.
//
// Per-node input is assembled from, in order:
//   1. block config defaults + the node's static config
//   2. workflow inputs (runtime values) mapped via definition.inputs
//   3. incoming edges (upstream node outputs piped in)
//
// definition = {
//   nodes:  [{ id, block, config }]            // block = registry slug
//   edges:  [{ from:{node,field}, to:{node,field} }]
//   inputs: [{ name, to:{node,field} }]
//   output: { node, field }
// }
import blocks from '../blocks/registry.js';

function blockSlug(node) {
  return node.block || node.agent || node.slug; // tolerate older keys
}

// Kahn topological sort; throws on cycle.
export function topoSort(def) {
  const incoming = new Map();
  for (const n of def.nodes) incoming.set(n.id, new Set());
  for (const e of def.edges || []) {
    if (incoming.has(e.to.node)) incoming.get(e.to.node).add(e.from.node);
  }
  const order = [];
  const remaining = new Set(def.nodes.map((n) => n.id));
  const ready = [...remaining].filter((id) => incoming.get(id).size === 0);
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    remaining.delete(id);
    for (const n of def.nodes) {
      const s = incoming.get(n.id);
      if (remaining.has(n.id) && s.has(id)) {
        s.delete(id);
        if (s.size === 0) ready.push(n.id);
      }
    }
  }
  if (remaining.size) throw new Error(`Workflow has a cycle: ${[...remaining].join(', ')}`);
  return order;
}

export async function runWorkflow(definition, runtimeInputs = {}, ctx = {}) {
  const def = definition || {};
  if (!Array.isArray(def.nodes) || def.nodes.length === 0) throw new Error('Workflow has no blocks.');
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const order = topoSort(def);
  const nodeOutputs = {};

  for (const nodeId of order) {
    const node = byId.get(nodeId);
    const slug = blockSlug(node);
    const block = blocks.get(slug);
    if (!block) throw new Error(`Unknown block "${slug}" on node ${nodeId}.`);
    if (block.comingSoon) throw new Error(`Block "${block.name}" is coming soon and can't run yet.`);

    const input = { ...blocks.resolveConfig(slug, node.config) };

    for (const wi of def.inputs || []) {
      if (wi.to && wi.to.node === nodeId && runtimeInputs[wi.name] !== undefined) {
        input[wi.to.field] = runtimeInputs[wi.name];
      }
    }
    for (const e of def.edges || []) {
      if (e.to.node !== nodeId) continue;
      const up = nodeOutputs[e.from.node];
      if (up === undefined) continue;
      input[e.to.field] = (!e.from.field || e.from.field === '*') ? up : up[e.from.field];
    }
    for (const [field, schema] of Object.entries(block.inputs || {})) {
      if (schema.required && (input[field] === undefined || input[field] === '')) {
        throw new Error(`Block "${block.name}" needs input "${field}".`);
      }
    }

    nodeOutputs[nodeId] = await block.run(input, ctx);
  }

  let output = nodeOutputs;
  if (def.output && def.output.node) {
    const o = nodeOutputs[def.output.node];
    output = (!def.output.field || def.output.field === '*') ? o : (o ? o[def.output.field] : undefined);
  }
  return { output, nodeOutputs };
}
