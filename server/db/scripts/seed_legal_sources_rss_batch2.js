// Second batch of RSS sources for AI legal ingestion.
//
// Each feed below was HEAD-probed and its Content-Type confirmed to be
// application/rss+xml / application/atom+xml before seeding.
//
// Safe to re-run: ON CONFLICT (kind, url) DO NOTHING.
//
// Run: node server/db/scripts/seed_legal_sources_rss_batch2.js

import pool from '../pool.js';

const SOURCES = [
  // ── European privacy / AI enforcement NGO ────────────────────────────────
  // noyb files complaints against AI services across EU DPAs — a primary
  // signal for GDPR-based AI enforcement actions.
  { name: 'noyb — European Centre for Digital Rights', kind: 'rss', url: 'https://noyb.eu/en/feed',
    jurisdiction: 'EU', tags: ['ngo', 'privacy', 'gdpr-enforcement'], frequency: 12 },

  // ── Legal-specialist tech + industry press ──────────────────────────────
  { name: 'Artificial Lawyer', kind: 'rss', url: 'https://www.artificiallawyer.com/feed/',
    jurisdiction: 'International', tags: ['news', 'legal-tech', 'ai-in-law'], frequency: 12 },
  { name: 'Legal IT Insider', kind: 'rss', url: 'https://legaltechnology.com/feed/',
    jurisdiction: 'International', tags: ['news', 'legal-tech'], frequency: 12 },
  { name: 'Legal Cheek', kind: 'rss', url: 'https://www.legalcheek.com/feed/',
    jurisdiction: 'UK', tags: ['news', 'legal'], frequency: 12 },
  { name: 'The Lawyer', kind: 'rss', url: 'https://www.thelawyer.com/feed/',
    jurisdiction: 'UK', tags: ['news', 'legal'], frequency: 12 },
  { name: 'Legal Futures', kind: 'rss', url: 'https://www.legalfutures.co.uk/feed',
    jurisdiction: 'UK', tags: ['news', 'legal'], frequency: 24 },
  { name: 'LawFuel', kind: 'rss', url: 'https://www.lawfuel.com/feed',
    jurisdiction: 'International', tags: ['news', 'legal'], frequency: 24 },

  // ── Policy NGOs ─────────────────────────────────────────────────────────
  { name: 'Center for Democracy & Technology', kind: 'rss', url: 'https://cdt.org/feed/',
    jurisdiction: 'International', tags: ['ngo', 'digital-rights', 'ai-policy'], frequency: 24 },

  // ── Topic-specific tech feeds (narrower = less noise than parent feeds) ──
  { name: 'The Verge — AI', kind: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    jurisdiction: 'International', tags: ['news', 'ai'], frequency: 12 },
  { name: 'MIT Technology Review — AI', kind: 'rss', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
    jurisdiction: 'International', tags: ['news', 'ai'], frequency: 24 },
  { name: 'The Register', kind: 'rss', url: 'https://www.theregister.com/headlines.atom',
    jurisdiction: 'International', tags: ['news', 'tech'], frequency: 12 },
];

async function run() {
  const client = await pool.connect();
  let inserted = 0, skipped = 0;
  try {
    for (const s of SOURCES) {
      const res = await client.query(
        `INSERT INTO ai_legal_sources (name, kind, url, jurisdiction, tags, run_frequency_hours, config)
         VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
         ON CONFLICT (kind, url) DO NOTHING
         RETURNING id`,
        [s.name, s.kind, s.url, s.jurisdiction, s.tags, s.frequency || 12]
      );
      if (res.rowCount > 0) { inserted++; console.log(`  inserted: ${s.name}`); }
      else                  { skipped++;  console.log(`  skipped  (exists): ${s.name}`); }
    }
    console.log(`\nDone. Inserted ${inserted}, skipped ${skipped} of ${SOURCES.length}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
