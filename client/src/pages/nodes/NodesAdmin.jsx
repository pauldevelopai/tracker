import { useState, useEffect } from 'react';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';

// Usage + feedback for the GROUNDED Nodes. Hosted usage = node_analytics_activity
// (written by the hosted Node per newsroom); local installs = node_beacons
// (each downloaded Node pings on startup unless GROUNDED_TELEMETRY=off);
// feedback = the Feedback widget. Read-only.

const muted = { fontSize: 13, color: 'var(--text-secondary)' };
const num = { fontVariantNumeric: 'tabular-nums' };
const TYPE_COLOR = { bug: '#EF4444', suggestion: '#3B82F6', praise: '#10B981', question: '#8B5CF6', other: '#94A3B8' };

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}
function splitFeedback(message) {
  const m = /^\[(\w+)\]\s*([\s\S]*)$/.exec(message || '');
  return m ? { type: m[1], text: m[2] } : { type: 'other', text: message || '' };
}
// Human label for an activity row.
function actLabel(r) {
  if (r.kind === 'error') return 'hit an error';
  if (r.kind === 'feedback') return 'sent feedback';
  if (r.op === 'ingest') return `uploaded a matrix${r.story_count ? ` (${r.story_count} stories)` : ''}`;
  if (r.op === 'brief') return 'generated a brief';
  if (r.op === 'setup') return 'set up their key';
  return `${r.kind || ''} ${r.op || ''}`.trim() || 'activity';
}

function Stat({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, ...num }}>{value}</div>
      {sub && <div style={muted}>{sub}</div>}
    </div>
  );
}
function Empty({ children }) {
  return <div className="card" style={{ padding: 18, marginBottom: 24, ...muted }}>{children}</div>;
}

export default function NodesAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/nodes/admin/overview').then(setData).catch((e) => setError(e.message || 'Could not load'));
  }, []);

  if (error) return (<div><PageHeader title="Nodes" /><div className="empty-state"><h3>{error}</h3></div></div>);
  if (!data) return (<div><PageHeader title="Nodes" /><p style={muted}>Loading…</p></div>);

  const { hosted = [], feedback = [], local = [], recent = [] } = data;
  const nameOf = (r) => r.member_name || r.member_email || (r.newsroom_id ? `Account ${String(r.newsroom_id).slice(0, 8)}` : 'Unknown');
  const sum = (arr, k) => arr.reduce((a, r) => a + Number(r[k] || 0), 0);
  const totalStories = sum(hosted, 'stories') + sum(local, 'story_count');
  const totalUploads = sum(hosted, 'ingests') + sum(local, 'ingests');

  return (
    <div>
      <PageHeader title="Nodes" />
      <p style={{ ...muted, marginTop: -8, marginBottom: 20 }}>
        How newsrooms are using the GROUNDED Nodes — online (hosted) and on their own machines (opt-in).
      </p>

      {/* ── Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Stat label="Newsrooms online" value={hosted.length} sub="using a Node hosted" />
        <Stat label="Local installs" value={local.length} sub="reported in" />
        <Stat label="Stories ingested" value={totalStories} />
        <Stat label="Uploads" value={totalUploads} />
        <Stat label="Feedback" value={feedback.length} />
      </div>

      {/* ── Hosted usage ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Hosted usage <span style={muted}>· {hosted.length} newsroom{hosted.length === 1 ? '' : 's'}</span>
      </h3>
      {hosted.length === 0 ? (
        <Empty>No newsrooms have used a Node online yet. When someone signs in at <code>/nodes/analytics/app/</code> and uploads, they appear here.</Empty>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 24, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 12px' }}>Newsroom</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stories</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Uploads</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Briefs</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Errors</th>
              <th style={{ padding: '10px 12px' }}>Last active</th>
            </tr></thead>
            <tbody>
              {hosted.map((r) => (
                <tr key={r.newsroom_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{nameOf(r)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.stories || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.ingests || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.briefs || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num, color: Number(r.errors) ? '#EF4444' : undefined }}>{Number(r.errors || 0)}</td>
                  <td style={{ padding: '10px 12px', ...muted }}>{fmtDate(r.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Recent activity ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Recent activity</h3>
      {recent.length === 0 ? (
        <Empty>No activity recorded yet.</Empty>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 24 }}>
          {recent.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '9px 14px', borderBottom: i < recent.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{r.member_email || 'Unknown'}</span>
              <span style={{ fontSize: 13, color: r.kind === 'error' ? '#EF4444' : 'var(--text-primary)' }}>{actLabel(r)}</span>
              <span style={{ ...muted, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtDate(r.ts)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Local installs ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Local installs <span style={muted}>· {local.length}</span>
      </h3>
      {local.length === 0 ? (
        <Empty>No downloaded installs have reported in yet. A Node pings here on startup with its newsroom, version, OS and counts (never story content) — unless its owner sets <code>GROUNDED_TELEMETRY=off</code>.</Empty>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 24, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 12px' }}>Newsroom / install</th>
              <th style={{ padding: '10px 12px' }}>Version</th>
              <th style={{ padding: '10px 12px' }}>OS</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stories</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Uploads</th>
              <th style={{ padding: '10px 12px' }}>Last seen</th>
            </tr></thead>
            <tbody>
              {local.map((r) => (
                <tr key={r.install_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{r.newsroom || 'Unnamed'}</div>
                    <div style={muted}>{r.node_slug} · {String(r.install_id).slice(0, 8)}</div>
                  </td>
                  <td style={{ padding: '10px 12px', ...muted }}>{r.node_version || '—'}</td>
                  <td style={{ padding: '10px 12px', ...muted }}>{r.os || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.story_count || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.ingests || 0)}</td>
                  <td style={{ padding: '10px 12px', ...muted }}>{fmtDate(r.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Feedback ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Feedback <span style={muted}>· {feedback.length}</span></h3>
      {feedback.length === 0 ? (
        <Empty>No feedback yet. The Feedback button inside each Node (and on the site) lands here.</Empty>
      ) : (
        feedback.map((f, i) => {
          const { type, text } = splitFeedback(f.message);
          return (
            <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'white', background: TYPE_COLOR[type] || TYPE_COLOR.other, padding: '2px 8px', borderRadius: 10 }}>{type}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{f.member_name || f.member_email || 'Unknown'}</span>
                <span style={{ ...muted, marginLeft: 'auto' }}>{fmtDate(f.ts)}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
