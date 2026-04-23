// Runnable CLI for the legal-ingest orchestrator.
//
// Usage:
//   npm run orchestrate                 # run all 4 phases (triage → audit → timeline → insights)
//   npm run orchestrate -- --phase=1    # just triage
//   npm run orchestrate -- --phases=3,4 # timeline + insights only
//   npm run orchestrate -- --dry        # print what would run, don't spend credits
//
// Output goes to stdout with ISO timestamps AND is tee'd to
// logs/orchestrate-<timestamp>.log so you can re-read later.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runTriagePhase,
  runDateAuditPhase,
  runTimelinePhase,
  runInsightsPhase,
  runDeepResearchPhase,
} from '../../services/legal-ingest/orchestrator.js';
import pool from '../../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '../../../logs');

function parseArgs() {
  const args = process.argv.slice(2);
  // Default run is 1-4. Phase 5 (deep research) is expensive and must be
  // explicitly requested via --phase=5 or --phases=...,5.
  const out = { phases: [1, 2, 3, 4], dry: false };
  for (const a of args) {
    if (a === '--dry') out.dry = true;
    else if (a.startsWith('--phase=')) out.phases = [parseInt(a.split('=')[1], 10)];
    else if (a.startsWith('--phases=')) out.phases = a.split('=')[1].split(',').map(s => parseInt(s, 10));
  }
  return out;
}

function makeLogger(logFilePath) {
  const stream = fs.createWriteStream(logFilePath, { flags: 'a' });
  return (msg = '') => {
    const ts = new Date().toISOString();
    const line = `${ts}  ${msg}`;
    console.log(line);
    stream.write(line + '\n');
  };
}

const PHASES = {
  1: { name: 'TRIAGE',            fn: runTriagePhase },
  2: { name: 'DATE AUDIT',        fn: runDateAuditPhase },
  3: { name: 'TIMELINE RESEARCH', fn: runTimelinePhase },
  4: { name: 'INSIGHTS BACKFILL', fn: runInsightsPhase },
  5: { name: 'DEEP RESEARCH',     fn: runDeepResearchPhase }, // opt-in, expensive; not in default run
};

async function main() {
  const opts = parseArgs();

  // Validate phase numbers early
  for (const p of opts.phases) {
    if (!PHASES[p]) {
      console.error(`Unknown phase: ${p}. Valid: 1, 2, 3, 4`);
      process.exit(2);
    }
  }

  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const logPath = path.join(LOGS_DIR, `orchestrate-${Date.now()}.log`);
  const log = makeLogger(logPath);

  log(`orchestrate: phases=${opts.phases.join(',')} dry=${opts.dry} log=${logPath}`);

  if (opts.dry) {
    log('DRY RUN — would execute:');
    for (const p of opts.phases) log(`  phase ${p}: ${PHASES[p].name}`);
    await pool.end();
    return;
  }

  const started = Date.now();
  const summary = {};

  for (const p of opts.phases) {
    const { name, fn } = PHASES[p];
    log('');
    log(`═══ PHASE ${p}: ${name} ═══`);
    try {
      summary[`phase${p}`] = await fn({ log });
    } catch (err) {
      log(`  PHASE ${p} CRASHED: ${err.message}`);
      summary[`phase${p}`] = { crashed: true, error: err.message };
    }
  }

  const elapsedMin = Math.round((Date.now() - started) / 60000);
  log('');
  log(`═══ COMPLETE in ${elapsedMin} min ═══`);
  log(JSON.stringify(summary, null, 2));

  await pool.end();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
