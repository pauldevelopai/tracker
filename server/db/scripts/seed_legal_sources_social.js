// Seed AI-law social accounts on Bluesky + Mastodon.
//
// These are public, high-signal commentators + outlets. Bluesky and Mastodon
// both expose free public APIs, no token needed to read public posts.
//
// Safe to re-run: ON CONFLICT (kind, url) DO NOTHING.
//
// Run: node server/db/scripts/seed_legal_sources_social.js

import pool from '../pool.js';

const SOURCES = [
  // ── Bluesky ───────────────────────────────────────────────────────────────
  // The URL is the profile page (used as the canonical source URL). The real
  // handle used by the API is in config.handle.
  { name: 'Emily M. Bender (Bluesky)',             kind: 'bluesky', url: 'https://bsky.app/profile/emilymbender.bsky.social',          jurisdiction: 'International', tags: ['social','ai-policy','academic'], frequency: 6,  config: { handle: 'emilymbender.bsky.social' } },
  { name: 'Margaret Mitchell (Bluesky)',           kind: 'bluesky', url: 'https://bsky.app/profile/mmitchell.bsky.social',               jurisdiction: 'International', tags: ['social','ai-ethics','academic'], frequency: 6,  config: { handle: 'mmitchell.bsky.social' } },
  { name: 'Kate Crawford (Bluesky)',               kind: 'bluesky', url: 'https://bsky.app/profile/katecrawford.bsky.social',            jurisdiction: 'International', tags: ['social','ai-policy','academic'], frequency: 12, config: { handle: 'katecrawford.bsky.social' } },
  { name: 'Lilian Edwards (Bluesky)',              kind: 'bluesky', url: 'https://bsky.app/profile/lilianedwards.bsky.social',           jurisdiction: 'UK',            tags: ['social','legal','academic'],     frequency: 12, config: { handle: 'lilianedwards.bsky.social' } },
  { name: 'Edward Ongweso Jr. (Bluesky)',          kind: 'bluesky', url: 'https://bsky.app/profile/bigblackjacobin.bsky.social',         jurisdiction: 'International', tags: ['social','tech-policy','journalist'], frequency: 12, config: { handle: 'bigblackjacobin.bsky.social' } },
  { name: 'Edward Zitron (Bluesky)',               kind: 'bluesky', url: 'https://bsky.app/profile/edzitron.com',                        jurisdiction: 'International', tags: ['social','tech-analysis','journalist'], frequency: 12, config: { handle: 'edzitron.com' } },
  { name: 'Daniel Solove (Bluesky)',               kind: 'bluesky', url: 'https://bsky.app/profile/danielsolove.bsky.social',            jurisdiction: 'US',            tags: ['social','privacy','academic'],   frequency: 12, config: { handle: 'danielsolove.bsky.social' } },

  // ── Mastodon ──────────────────────────────────────────────────────────────
  { name: 'EFF (Mastodon)',                        kind: 'mastodon',url: 'https://mastodon.social/@eff',                                 jurisdiction: 'International', tags: ['social','ngo','digital-rights'], frequency: 6,  config: { instance: 'mastodon.social', handle: 'eff' } },
  { name: 'Mike Masnick (Mastodon)',               kind: 'mastodon',url: 'https://mastodon.social/@mmasnick',                            jurisdiction: 'International', tags: ['social','tech-policy','journalist'], frequency: 12, config: { instance: 'mastodon.social', handle: 'mmasnick' } },
  { name: 'noyb.eu (Mastodon)',                    kind: 'mastodon',url: 'https://mastodon.social/@noybeu',                              jurisdiction: 'EU',            tags: ['social','ngo','privacy'],        frequency: 12, config: { instance: 'mastodon.social', handle: 'noybeu' } },
];

async function run() {
  const client = await pool.connect();
  let inserted = 0, skipped = 0;
  try {
    for (const s of SOURCES) {
      const res = await client.query(
        `INSERT INTO ai_legal_sources (name, kind, url, jurisdiction, tags, run_frequency_hours, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (kind, url) DO NOTHING
         RETURNING id`,
        [s.name, s.kind, s.url, s.jurisdiction, s.tags, s.frequency || 12, JSON.stringify(s.config || {})]
      );
      if (res.rowCount > 0) { inserted++; console.log(`  inserted: ${s.name}`); }
      else                  { skipped++;  console.log(`  skipped:  ${s.name}`); }
    }
    console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}, total input ${SOURCES.length}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
