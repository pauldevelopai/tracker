// Runnable CLI for the weekly AI Legal digest.
//
// Usage:
//   node server/db/scripts/send_digest.js              # live send via EMAIL_PROVIDER
//   node server/db/scripts/send_digest.js --dry-run    # count subscribers, no send
//   node server/db/scripts/send_digest.js --since=14   # different lookback window
//   EMAIL_PROVIDER=console node ...                    # force console output

import { sendWeeklyDigest } from '../../services/email/digest.js';
import pool from '../../db/pool.js';

const args = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const sinceArg = args.find(a => a.startsWith('--since='));
const sinceDays = sinceArg ? parseInt(sinceArg.split('=')[1], 10) : 7;

console.log(`[digest] provider=${process.env.EMAIL_PROVIDER || 'console'} since=${sinceDays}d dryRun=${dryRun}`);

try {
  const summary = await sendWeeklyDigest({ sinceDays, dryRun });
  console.log('[digest] summary:', JSON.stringify(summary, null, 2));
} catch (err) {
  console.error('[digest] FATAL:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
