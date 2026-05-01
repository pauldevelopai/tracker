// Scraper-only nightly job: dispatch every due AI Legal source, write raw
// items to ai_legal_raw_items, exit. NO Claude API calls. Items queue up
// for human review at /legal-sources or for a later orchestrate run.
//
// Run manually:   npm run scrape
// Run from cron:  see deploy notes — `0 2 * * *` on the Lightsail box.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchDueSources, closePuppeteer } from '../../services/legal-ingest/dispatcher.js';
import pool from '../pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '../../../logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(LOGS_DIR, `scrape-${stamp}.log`);
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function log(msg = '') {
  const line = `${new Date().toISOString()}  ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

async function main() {
  log(`scrape-only: starting`);
  const summaries = await dispatchDueSources({ limit: 100 });

  const ok       = summaries.filter(s => s.status === 'success').length;
  const errored  = summaries.filter(s => s.status === 'error').length;
  const itemsNew = summaries.reduce((acc, s) => acc + (s.items_new || 0), 0);
  const seen     = summaries.reduce((acc, s) => acc + (s.items_seen || 0), 0);

  log(`sources_dispatched=${summaries.length} ok=${ok} err=${errored} items_seen=${seen} items_new=${itemsNew}`);

  for (const s of summaries) {
    log(`  ${s.status === 'success' ? '✓' : '✗'} ${s.source || '(unnamed)'}: seen=${s.items_seen || 0} new=${s.items_new || 0}${s.error ? ` err=${s.error}` : ''}`);
  }

  log(`scrape-only: done (log: ${logPath})`);
}

main()
  .catch(err => { log(`FATAL: ${err.message}\n${err.stack}`); process.exitCode = 1; })
  .finally(async () => {
    try { await closePuppeteer(); } catch {}
    try { await pool.end(); } catch {}
    logStream.end();
  });
