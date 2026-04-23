// One-shot: sync all US lawsuits from CourtListener.
// Uses COURTLISTENER_TOKEN from .env. Safe to re-run — idempotent upserts.

import { syncAllUsLawsuits } from '../../services/legal-ingest/courtlistener.js';
import pool from '../../db/pool.js';

const started = Date.now();
console.log(`[${new Date().toISOString()}] CL bulk sync: starting`);

try {
  const r = await syncAllUsLawsuits({ limit: 60 });
  console.log(`[${new Date().toISOString()}] CL sync done in ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`  seen=${r.seen}  synced=${r.synced}  needs_review=${r.needs_review}  errors=${r.errors}  events_inserted=${r.events_inserted}`);
  if (r.needs_review > 0) {
    console.log(`\n[needs review — no docket auto-match found]`);
    for (const c of r.per_case.filter(x => x.needs_review)) {
      console.log(`  - ${c.case_name || c.lawsuit_id}: ${c.reason || ''}`);
    }
  }
  if (r.errors > 0) {
    console.log(`\n[errors]`);
    for (const c of r.per_case.filter(x => x.error)) {
      console.log(`  - ${c.case_name || c.lawsuit_id}: ${c.error}`);
    }
  }
} catch (err) {
  console.error('FATAL:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
