// Generic content-pipeline dispatcher — the domain-parameterised twin of the
// legal dispatcher. Operates on content_sources / content_raw_items /
// content_source_runs, tagged by `domain`. Reuses the SAME scraper functions as
// the legal pipeline (rss/html/bluesky/mastodon/puppeteer) — they take a source
// row and return raw items, so they're domain-agnostic.
//
//   await dispatchDueContentSources({ domain: 'monetisation' });  // due sources
//   await dispatchContentSource(sourceId);                        // force one

import pool from '../../db/pool.js';
import { scrapeRss } from '../legal-ingest/rss-scraper.js';
import { scrapeHtml } from '../legal-ingest/html-scraper.js';
import { scrapeBluesky } from '../legal-ingest/bluesky-scraper.js';
import { scrapeMastodon } from '../legal-ingest/mastodon-scraper.js';
import { scrapePuppeteer, closeBrowser as closePuppeteer } from '../legal-ingest/puppeteer-scraper.js';

const SCRAPERS = {
  rss: scrapeRss,
  html: scrapeHtml,
  bluesky: scrapeBluesky,
  mastodon: scrapeMastodon,
  puppeteer: scrapePuppeteer,
};
export { closePuppeteer };

export async function dispatchDueContentSources({ domain = null, limit = 10 } = {}) {
  const params = [];
  let where = `active = true
        AND (last_run_at IS NULL OR last_run_at + (run_frequency_hours || ' hours')::interval <= NOW())`;
  if (domain) { params.push(domain); where += ` AND domain = $${params.length}`; }
  params.push(limit);
  const { rows: due } = await pool.query(
    `SELECT * FROM content_sources WHERE ${where} ORDER BY last_run_at ASC NULLS FIRST LIMIT $${params.length}`,
    params
  );
  const summaries = [];
  for (const source of due) summaries.push(await runSourceSafe(source));
  return summaries;
}

export async function dispatchContentSource(sourceId) {
  const { rows } = await pool.query('SELECT * FROM content_sources WHERE id = $1', [sourceId]);
  if (rows.length === 0) throw new Error('Source not found');
  return runSourceSafe(rows[0]);
}

async function runSourceSafe(source) {
  const scraper = SCRAPERS[source.kind];
  if (!scraper) return recordFailure(source, new Error(`No scraper for kind '${source.kind}'`));

  const runId = await startRun(source.id, source.domain);
  try {
    const items = await scraper(source);
    const { inserted, duplicates } = await persistItems(source, items);
    await finishRun(runId, { items_seen: items.length, items_new: inserted, items_duplicate: duplicates, status: 'success' });
    await pool.query(
      `UPDATE content_sources
          SET last_run_at = NOW(), last_success_at = NOW(), last_error = NULL,
              items_seen = items_seen + $1, items_new = items_new + $2, updated_at = NOW()
        WHERE id = $3`,
      [items.length, inserted, source.id]
    );
    return { source: source.name, status: 'success', items_seen: items.length, items_new: inserted, items_duplicate: duplicates };
  } catch (err) {
    return recordFailure(source, err, runId);
  }
}

async function recordFailure(source, err, runId) {
  const message = (err && err.message) || String(err);
  if (runId) await finishRun(runId, { status: 'error', error: message });
  await pool.query(
    `UPDATE content_sources SET last_run_at = NOW(), last_error = $1, updated_at = NOW() WHERE id = $2`,
    [message.slice(0, 2000), source.id]
  );
  console.error(`[content-ingest:${source.domain}] ${source.name}: ${message}`);
  return { source: source.name, status: 'error', error: message };
}

async function startRun(sourceId, domain) {
  const { rows } = await pool.query(
    `INSERT INTO content_source_runs (source_id, domain) VALUES ($1, $2) RETURNING id`,
    [sourceId, domain]
  );
  return rows[0].id;
}

async function finishRun(runId, { items_seen = 0, items_new = 0, items_duplicate = 0, status, error = null }) {
  await pool.query(
    `UPDATE content_source_runs
        SET finished_at = NOW(), items_seen = $1, items_new = $2, items_duplicate = $3, status = $4, error = $5
      WHERE id = $6`,
    [items_seen, items_new, items_duplicate, status, error, runId]
  );
}

async function persistItems(source, items) {
  let inserted = 0, duplicates = 0;
  for (const it of items) {
    const externalId = it.external_id || it.url || `${source.id}:${it.title || 'unknown'}`;
    const res = await pool.query(
      `INSERT INTO content_raw_items
         (source_id, domain, external_id, url, title, content, author, published_at, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::jsonb)
       ON CONFLICT (source_id, external_id) DO NOTHING
       RETURNING id`,
      [
        source.id, source.domain, externalId.slice(0, 2000), it.url || null,
        it.title ? it.title.slice(0, 500) : null, it.content || null,
        it.author ? it.author.slice(0, 300) : null, it.published_at || null,
        it.raw_payload ? JSON.stringify(it.raw_payload) : null,
      ]
    );
    if (res.rowCount > 0) inserted++; else duplicates++;
  }
  return { inserted, duplicates };
}
