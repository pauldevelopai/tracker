// Weekly AI Legal digest. Summarises the past 7 days of lawsuit + regulation
// events and sends one email per confirmed entity_kind='all' subscriber.
//
// Usage from a cron / scheduled task:
//   import { sendWeeklyDigest } from './digest.js';
//   await sendWeeklyDigest();
//
// Or run manually: `node server/db/scripts/send_digest.js --dry-run`

import pool from '../../db/pool.js';
import { getMailer } from './providers.js';

const SITE_BASE = process.env.PUBLIC_BASE_URL || 'https://ailegal.co.za';

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

async function loadWeeklyEvents({ sinceDays = 7 } = {}) {
  const { rows } = await pool.query(
    `SELECT 'lawsuit_event' AS type,
            e.id AS event_id,
            e.event_date,
            e.event_type,
            e.title,
            e.description,
            l.id AS item_id,
            l.case_name AS item_name,
            l.jurisdiction
       FROM ai_lawsuit_events e
       JOIN ai_lawsuits l ON l.id = e.lawsuit_id
      WHERE e.created_at > NOW() - ($1 || ' days')::interval
      UNION ALL
     SELECT 'regulation_event' AS type,
            e.id AS event_id,
            e.event_date,
            e.event_type,
            e.title,
            e.description,
            r.id AS item_id,
            COALESCE(r.short_name, r.regulation_name) AS item_name,
            r.jurisdiction
       FROM ai_regulation_events e
       JOIN ai_regulations r ON r.id = e.regulation_id
      WHERE e.created_at > NOW() - ($1 || ' days')::interval
      ORDER BY event_date DESC NULLS LAST`,
    [String(sinceDays)]
  );
  return rows;
}

function buildDigestHtml({ events, unsubscribeToken, weekStart, weekEnd }) {
  const lawsuitEvents    = events.filter(e => e.type === 'lawsuit_event');
  const regulationEvents = events.filter(e => e.type === 'regulation_event');
  const rangeLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  const renderEvent = (e) => {
    const kind = e.type === 'lawsuit_event' ? 'lawsuits' : 'regulations';
    const url = `${SITE_BASE}/${kind}/${e.item_id}`;
    return `
      <div style="padding:12px 0;border-top:1px solid #eee">
        <div style="font-size:12px;color:#666;margin-bottom:4px">
          ${esc(e.jurisdiction || '')} · ${esc(e.event_type || 'update')} · ${esc(formatDate(e.event_date))}
        </div>
        <div style="font-size:15px;font-weight:600;line-height:1.4;margin-bottom:4px">
          <a href="${esc(url)}" style="color:#111;text-decoration:none">${esc(e.title || '(no title)')}</a>
        </div>
        <div style="font-size:13px;color:#555;line-height:1.5;margin-bottom:4px">
          ${esc((e.description || '').slice(0, 280))}
        </div>
        <div style="font-size:12px;color:#4F46E5">
          <a href="${esc(url)}" style="color:#4F46E5;text-decoration:none">${esc(e.item_name)} →</a>
        </div>
      </div>`;
  };

  const section = (title, items) => items.length === 0 ? '' : `
    <h2 style="font-size:16px;margin:28px 0 8px 0;color:#111">${esc(title)} (${items.length})</h2>
    ${items.map(renderEvent).join('')}
  `;

  const unsub = unsubscribeToken
    ? `${SITE_BASE}/api/public/subscriptions/unsubscribe/${unsubscribeToken}`
    : '#';

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111;line-height:1.5">
  <div style="margin-bottom:24px">
    <div style="font-size:12px;font-weight:700;color:#4F46E5;letter-spacing:0.08em;text-transform:uppercase">AI Legal</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px">Weekly digest</div>
    <div style="font-size:13px;color:#666;margin-top:2px">${esc(rangeLabel)}</div>
  </div>

  ${events.length === 0 ? `
    <div style="padding:24px;background:#f9fafb;border-radius:8px;color:#666;text-align:center">
      No new AI legal events this week.
    </div>
  ` : `
    ${section('Lawsuit developments', lawsuitEvents)}
    ${section('Regulation developments', regulationEvents)}
  `}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#888">
    You're receiving this because you subscribed at ${esc(SITE_BASE)}.
    <a href="${esc(unsub)}" style="color:#888">Unsubscribe</a>.
  </div>
</body></html>`;
}

function buildDigestText({ events, unsubscribeToken, weekStart, weekEnd }) {
  const unsub = unsubscribeToken ? `${SITE_BASE}/api/public/subscriptions/unsubscribe/${unsubscribeToken}` : '';
  const header = `AI Legal — weekly digest\n${formatDate(weekStart)} – ${formatDate(weekEnd)}\n\n`;
  if (events.length === 0) return `${header}No new AI legal events this week.\n\n— Unsubscribe: ${unsub}\n`;
  const lines = events.map(e => {
    const kind = e.type === 'lawsuit_event' ? 'lawsuits' : 'regulations';
    const url = `${SITE_BASE}/${kind}/${e.item_id}`;
    return `• [${e.jurisdiction || '—'}] ${e.title}\n  ${e.item_name} — ${formatDate(e.event_date)}\n  ${url}`;
  }).join('\n\n');
  return `${header}${lines}\n\n— Unsubscribe: ${unsub}\n`;
}

export async function sendWeeklyDigest({ sinceDays = 7, dryRun = false } = {}) {
  const weekEnd = new Date();
  const weekStart = new Date(Date.now() - sinceDays * 86400 * 1000);

  const events = await loadWeeklyEvents({ sinceDays });
  const { rows: subs } = await pool.query(
    `SELECT id, email, unsubscribe_token, last_sent_at
       FROM ai_legal_subscriptions
      WHERE entity_kind = 'all'
        AND confirmed_at IS NOT NULL
        AND unsubscribed_at IS NULL
        AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '6 days')`
  );

  const summary = { subscribers: subs.length, events: events.length, sent: 0, failed: 0, errors: [] };
  if (subs.length === 0) return summary;

  const mailer = await getMailer();
  const subject = events.length === 0
    ? `AI Legal — quiet week (${formatDate(weekStart)}–${formatDate(weekEnd)})`
    : `AI Legal — ${events.length} update${events.length === 1 ? '' : 's'} this week`;

  for (const s of subs) {
    const html = buildDigestHtml({ events, unsubscribeToken: s.unsubscribe_token, weekStart, weekEnd });
    const text = buildDigestText({ events, unsubscribeToken: s.unsubscribe_token, weekStart, weekEnd });

    if (dryRun) {
      summary.sent++;
      continue;
    }
    const r = await mailer.send({
      to: s.email,
      subject,
      html,
      text,
      headers: { 'List-Unsubscribe': `<${SITE_BASE}/api/public/subscriptions/unsubscribe/${s.unsubscribe_token}>` },
    });
    if (r.ok) {
      summary.sent++;
      await pool.query('UPDATE ai_legal_subscriptions SET last_sent_at = NOW() WHERE id = $1', [s.id]);
    } else {
      summary.failed++;
      summary.errors.push({ email: s.email, error: r.error });
    }
  }

  return summary;
}
