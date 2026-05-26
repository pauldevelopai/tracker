import { useState, useEffect } from 'react';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';

// Per-newsroom usage + feedback for the GROUNDED Nodes. Hosted usage comes from
// node_analytics_activity (written by the hosted Node, scoped by newsroom_id);
// local installs come from node_beacons (opt-in, default off). Read-only.

const muted = { fontSize: 13, color: 'var(--text-secondary)' };
const num = { fontVariantNumeric: 'tabular-nums' };

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

// Hosted feedback is stored as "[type] message" in the activity response column.
function splitFeedback(message) {
  const m = /^\[(\w+)\]\s*([\s\S]*)$/.exec(message || '');
  return m ? { type: m[1], text: m[2] } : { type: 'other', text: message || '' };
}

const TYPE_COLOR = {
  bug: '#EF4444', suggestion: '#3B82F6', praise: '#10B981',
  question: '#8B5CF6', other: '#94A3B8',
};

export default function NodesAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/nodes/admin/overview')
      .then(setData)
      .catch((e) => setError(e.message || 'Could not load'));
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Nodes" />
        <div className="empty-state"><h3>{error}</h3></div>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <PageHeader title="Nodes" />
        <p style={muted}>Loading…</p>
      </div>
    );
  }

  const { hosted = [], feedback = [], local = [] } = data;
  const nameOf = (r) => r.member_name || r.member_email || (r.newsroom_id ? `Account ${String(r.newsroom_id).slice(0, 8)}` : 'Unknown');

  return (
    <div>
      <PageHeader title="Nodes" />
      <p style={{ ...muted, marginTop: -8, marginBottom: 20 }}>
        Usage and feedback for the GROUNDED Nodes, per newsroom. Hosted newsrooms
        use the Node online; local installs appear here only if they opted in to
        share usage.
      </p>

      {/* ── Hosted usage ─────────────────────────────────────────────── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Hosted usage <span style={muted}>· {hosted.length} newsroom{hosted.length === 1 ? '' : 's'}</span>
      </h3>
      {hosted.length === 0 ? (
        <div className="empty-state"><h3>No hosted usage yet.</h3></div>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 24, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px' }}>Newsroom</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stories</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Uploads</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Briefs</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Errors</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Feedback</th>
                <th style={{ padding: '10px 12px' }}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {hosted.map((r) => (
                <tr key={r.newsroom_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{nameOf(r)}</div>
                    {r.member_email && r.member_name && <div style={muted}>{r.member_email}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.stories || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.ingests || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.briefs || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num, color: Number(r.errors) ? '#EF4444' : undefined }}>{Number(r.errors || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.feedback_count || 0)}</td>
                  <td style={{ padding: '10px 12px', ...muted }}>{fmtDate(r.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Local installs (opt-in beacon) ───────────────────────────── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Local installs <span style={muted}>· {local.length} opted in</span>
      </h3>
      {local.length === 0 ? (
        <div className="empty-state"><h3>No local installs have opted in to share usage.</h3></div>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 24, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px' }}>Newsroom / install</th>
                <th style={{ padding: '10px 12px' }}>Version</th>
                <th style={{ padding: '10px 12px' }}>OS</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stories</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Uploads</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Briefs</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Errors</th>
                <th style={{ padding: '10px 12px' }}>Last seen</th>
              </tr>
            </thead>
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
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num }}>{Number(r.briefs || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', ...num, color: Number(r.errors) ? '#EF4444' : undefined }}>{Number(r.errors || 0)}</td>
                  <td style={{ padding: '10px 12px', ...muted }}>{fmtDate(r.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Feedback ─────────────────────────────────────────────────── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Feedback <span style={muted}>· {feedback.length}</span>
      </h3>
      {feedback.length === 0 ? (
        <div className="empty-state"><h3>No feedback yet.</h3></div>
      ) : (
        feedback.map((f, i) => {
          const { type, text } = splitFeedback(f.message);
          return (
            <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'white', background: TYPE_COLOR[type] || TYPE_COLOR.other, padding: '2px 8px', borderRadius: 10 }}>
                  {type}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{f.member_name || f.member_email || (f.newsroom_id ? `Account ${String(f.newsroom_id).slice(0, 8)}` : 'Unknown')}</span>
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
