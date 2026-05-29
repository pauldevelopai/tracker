import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import { muted, StatusBadge, fmtDate } from './pulseUi.jsx';

// Newsroom detail: the deep dataset on a newsroom's Pulse journey — cycle
// timeline, tag trends, and (prominently) every open-text answer they've given.
export default function PulseNewsroomDetail() {
  const { id } = useParams();
  const [cycles, setCycles] = useState(null);
  const [details, setDetails] = useState([]);   // full cycle objects (with questions + response)
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/pulse/cycles?newsroom=${id}`)
      .then(async (list) => {
        setCycles(list);
        const full = await Promise.all(list.map((c) => apiFetch(`/pulse/cycles/${c.id}`).catch(() => null)));
        setDetails(full.filter(Boolean));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return (<div><PageHeader title="Pulse newsroom" /><div className="empty-state"><h3>{error}</h3></div></div>);
  if (!cycles) return (<div><PageHeader title="Pulse newsroom" /><p style={muted}>Loading…</p></div>);

  const name = cycles[0]?.newsroom || details[0]?.fields?.Newsroom || 'Newsroom';
  const latest = [...cycles].sort((a, b) => new Date(b.triggeredDate) - new Date(a.triggeredDate))[0];

  // Tag frequencies across all questions ever asked this newsroom.
  const tagCounts = {};
  for (const d of details) {
    for (const q of (d.questions || [])) {
      const t = q.fields?.Tag?.name || q.fields?.Tag;
      if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  const tagMax = Math.max(1, ...Object.values(tagCounts));

  // Open-text answers, newest first — the gold.
  const openAnswers = details
    .filter((d) => d.response?.fields?.['Open feedback'])
    .map((d) => ({
      cycleId: d.id,
      date: d.response.fields['Submitted at'] || d.fields?.['Triggered date'],
      who: d.response.fields['Respondent name'],
      role: d.response.fields['Respondent role'],
      text: d.response.fields['Open feedback'],
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <PageHeader title={`Pulse · ${name}`} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: -8, marginBottom: 20 }}>
        <span style={muted}>{cycles.length} cycle{cycles.length === 1 ? '' : 's'} · node {latest?.nodeInstall || '—'} · version {latest?.publicUrl ? '' : ''}{details.find(d => d.id === latest?.id)?.fields?.['Node version before'] || '—'}</span>
        <Link to="/admin/pulse" style={{ ...muted, marginLeft: 'auto', color: 'var(--accent)', textDecoration: 'none' }}>← all cycles</Link>
      </div>

      {/* Open-text answers — prominent */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>What they've told us <span style={muted}>· {openAnswers.length}</span></h3>
      {openAnswers.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 28 }}><h3>No open feedback yet.</h3></div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {openAnswers.map((a) => (
            <div key={a.cycleId} className="card" style={{ padding: 16, marginBottom: 10, borderLeft: '3px solid var(--accent, #6366F1)' }}>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.text}</div>
              <div style={{ ...muted, marginTop: 8 }}>{a.who ? `${a.who}${a.role ? `, ${a.role}` : ''} · ` : ''}{fmtDate(a.date)} · <Link to={`/admin/pulse/cycles/${a.cycleId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>open cycle →</Link></div>
            </div>
          ))}
        </div>
      )}

      {/* Tag trends */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Tag library</h3>
      {Object.keys(tagCounts).length === 0 ? (
        <p style={muted}>No tags yet.</p>
      ) : (
        <div className="card" style={{ padding: 16, marginBottom: 28 }}>
          {Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, n]) => (
            <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, width: 150 }}>{tag}</span>
              <div style={{ flex: 1, background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 4, height: 10 }}>
                <div style={{ width: `${(n / tagMax) * 100}%`, background: 'var(--accent, #6366F1)', height: 10, borderRadius: 4 }} />
              </div>
              <span style={{ ...muted, width: 24, textAlign: 'right' }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cycle timeline */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Cycle timeline</h3>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              {['Triggered', 'Node', 'Status', "Blocking", ''].map((h) => <th key={h} style={{ padding: '10px 12px' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...cycles].sort((a, b) => new Date(b.triggeredDate) - new Date(a.triggeredDate)).map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 12px', ...muted }}>{fmtDate(c.triggeredDate)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>{c.nodeInstall}</td>
                <td style={{ padding: '10px 12px' }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: '10px 12px' }}>{c.blocking}</td>
                <td style={{ padding: '10px 12px' }}><Link to={`/admin/pulse/cycles/${c.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
