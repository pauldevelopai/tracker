// Nightly triage: drain up to 100 pending raw items through the LLM
// classifier, then exit. Sized for the 45s/call Groq throttle so a full
// run finishes inside ~75 minutes — fits a single cron window.
//
// Run manually:   npm run triage
// Run from cron:  see README — `30 2 * * *` on the Lightsail box.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { triagePendingItems } from '../../services/legal-ingest/triage.js';
import pool from '../pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '../../../logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

const NIGHTLY_LIMIT = parseInt(process.env.TRIAGE_NIGHTLY_LIMIT || '100', 10);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(LOGS_DIR, `triage-${stamp}.log`);
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function log(msg = '') {
  const line = `${new Date().toISOString()}  ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

async function main() {
  log(`triage-nightly: starting (limit=${NIGHTLY_LIMIT}, backend=${process.env.LLM_BACKEND || 'ollama'})`);
  const t0 = Date.now();
  const r = await triagePendingItems({ limit: NIGHTLY_LIMIT });
  const elapsedMin = Math.round((Date.now() - t0) / 60000);

  log(`seen=${r.seen} promoted=${r.promoted} rejected=${r.rejected} classified=${r.classified} errors=${r.errors.length} elapsed_min=${elapsedMin}`);

  if (r.errors.length) {
    log('errors:');
    for (const e of r.errors.slice(0, 10)) {
      log(`  - ${(e.error || JSON.stringify(e)).slice(0, 250)}`);
    }
  }

  log(`triage-nightly: done (log: ${logPath})`);
}

main()
  .catch(err => { log(`FATAL: ${err.message}\n${err.stack}`); process.exitCode = 1; })
  .finally(async () => {
    try { await pool.end(); } catch {}
    logStream.end();
  });
