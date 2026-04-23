// Third batch of free RSS/Atom sources for the ingest pipeline.
//
// Focuses on the gaps we identified after reviewing the batch1+batch2 coverage:
//   - US regulators beyond FTC (DOJ, SEC, Copyright Office)
//   - Non-US DPAs with English RSS feeds (CNIL)
//   - Legal-analysis blogs that already cover AI copyright/IP cases
//   - CourtListener opinion feeds for circuits hearing AI appeals (free,
//     unlike the docket-entries endpoint which requires paid PACER)
//
// Safe to re-run — INSERT ... ON CONFLICT DO NOTHING.
//
// Run: node server/db/scripts/seed_legal_sources_rss_batch3.js

import pool from '../pool.js';

const SOURCES = [
  // ── US regulators / enforcement (filling gaps past FTC) ─────────────────
  { name: 'US DOJ Press Office',              kind: 'rss', url: 'https://www.justice.gov/news/rss',                                          jurisdiction: 'US Federal',   tags: ['regulator', 'enforcement', 'official'], frequency: 12 },
  { name: 'US SEC Press Releases',            kind: 'rss', url: 'https://www.sec.gov/news/pressreleases.rss',                                jurisdiction: 'US Federal',   tags: ['regulator', 'enforcement', 'official'], frequency: 12 },
  { name: 'US Copyright Office',              kind: 'rss', url: 'https://www.copyright.gov/rss/pressreleases.xml',                           jurisdiction: 'US Federal',   tags: ['regulator', 'copyright', 'official'],   frequency: 24 },
  { name: 'White House Briefing Room',        kind: 'rss', url: 'https://www.whitehouse.gov/feed/',                                          jurisdiction: 'US Federal',   tags: ['government', 'official'],                frequency: 24 },

  // ── US federal circuit opinions (via CourtListener — free) ──────────────
  { name: 'CourtListener — 9th Circuit',      kind: 'rss', url: 'https://www.courtlistener.com/feed/court/ca9/',                             jurisdiction: 'US Federal',   tags: ['court', 'opinions', 'official'],         frequency: 12 },
  { name: 'CourtListener — 2nd Circuit',      kind: 'rss', url: 'https://www.courtlistener.com/feed/court/ca2/',                             jurisdiction: 'US Federal',   tags: ['court', 'opinions', 'official'],         frequency: 12 },
  { name: 'CourtListener — Federal Circuit',  kind: 'rss', url: 'https://www.courtlistener.com/feed/court/cafc/',                            jurisdiction: 'US Federal',   tags: ['court', 'opinions', 'official'],         frequency: 12 },
  { name: 'CourtListener — D.C. Circuit',     kind: 'rss', url: 'https://www.courtlistener.com/feed/court/cadc/',                            jurisdiction: 'US Federal',   tags: ['court', 'opinions', 'official'],         frequency: 12 },
  { name: 'CourtListener — N.D. Cal.',        kind: 'rss', url: 'https://www.courtlistener.com/feed/court/cand/',                            jurisdiction: 'US Federal',   tags: ['court', 'opinions', 'official'],         frequency: 12 },

  // ── Non-US regulators (English-language feeds) ──────────────────────────
  { name: 'CNIL (France)',                    kind: 'rss', url: 'https://www.cnil.fr/en/news/feed',                                          jurisdiction: 'France',       tags: ['regulator', 'dpa', 'official'],          frequency: 24 },
  { name: 'Canada OPC News',                  kind: 'rss', url: 'https://www.priv.gc.ca/en/newsroom/rss-feed/',                              jurisdiction: 'Canada',       tags: ['regulator', 'dpa', 'official'],          frequency: 24 },

  // ── Legal-analysis blogs (strong AI-copyright coverage) ─────────────────
  { name: 'JD Supra — Artificial Intelligence', kind: 'rss', url: 'https://www.jdsupra.com/topics/artificial-intelligence/feed/',            jurisdiction: 'International', tags: ['legal', 'analysis', 'aggregator'],    frequency: 12 },
  { name: 'Technology & Marketing Law Blog',  kind: 'rss', url: 'https://blog.ericgoldman.org/feed/',                                        jurisdiction: 'International', tags: ['legal', 'analysis', 'internet-law'],  frequency: 24 },
  { name: 'Patently-O',                       kind: 'rss', url: 'https://patentlyo.com/feed',                                                jurisdiction: 'US Federal',   tags: ['legal', 'analysis', 'patent'],           frequency: 24 },
  { name: 'Above the Law',                    kind: 'rss', url: 'https://abovethelaw.com/feed/',                                             jurisdiction: 'International', tags: ['legal', 'news'],                       frequency: 12 },

  // ── Academic / research trackers ────────────────────────────────────────
  { name: 'AI Now Institute',                 kind: 'rss', url: 'https://ainowinstitute.org/feed',                                           jurisdiction: 'International', tags: ['academic', 'ai-accountability'],      frequency: 48 },
  { name: 'Oxford Internet Institute — News', kind: 'rss', url: 'https://www.oii.ox.ac.uk/news-events/news/feed',                            jurisdiction: 'UK',           tags: ['academic', 'research'],                   frequency: 48 },

  // ── Policy analysis ─────────────────────────────────────────────────────
  { name: 'Brookings AI',                     kind: 'rss', url: 'https://www.brookings.edu/topic/artificial-intelligence/feed/',             jurisdiction: 'International', tags: ['think-tank', 'policy'],                frequency: 48 },
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
      if (res.rowCount > 0) {
        inserted++;
        console.log(`  inserted: ${s.name}`);
      } else {
        skipped++;
        console.log(`  skipped (exists): ${s.name}`);
      }
    }
    console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}, total input ${SOURCES.length}.`);
    console.log('\nTo validate these are reachable, trigger the dispatcher and');
    console.log('check /legal-sources in the admin UI for any marked failing.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
