import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import { muted, StatusBadge, fmtDate, sendJson } from './pulseUi.jsx';

const num = { fontVariantNumeric: 'tabular-nums' };
const ACTIVE = new Set(['Draft', 'Vetted', 'Sent', 'Responded', 'Plan drafted', 'Plan approved', 'Shipped']);
const RESPONDED_OR_BEYOND = new Set(['Responded', 'Plan drafted', 'Plan approved', 'Shipped', 'Reported back']);
const SENT_OR_BEYOND = new Set(['Sent', ...RESPONDED_OR_BEYOND]);

function Stat({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4, ...num }}>{value}</div>
      {sub && <div style={muted}>{sub}</div>}
    </div>
  );
}

// Modal to trigger a new cycle: pick a node install (prefills the fuzzy-matched
// newsroom for Paul to confirm) or pick a newsroom + node slug directly.
function TriggerModal({ presetNewsroom, newsrooms, installs, onClose, onCreated }) {
  const [newsroomId, setNewsroomId] = useState(presetNewsroom?.id || '');
  const [installId, setInstallId] = useState('');
  const [nodeSlug, setNodeSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // When an install is chosen, prefill its best newsroom match (unless preset).
  function chooseInstall(id) {
    setInstallId(id);
    const inst = installs.find((i) => i.id === id);
    setNodeSlug(inst?.slug || '');
    if (!presetNewsroom && inst?.newsroomMatches?.[0]) setNewsroomId(inst.newsroomMatches[0].id);
  }

  async function create() {
    setBusy(true); setError(null);
    try {
      const body = { newsroomId };
      if (installId) body.nodeInstallId = installId;
      if (nodeSlug) body.nodeSlug = nodeSlug;
      const cycle = await sendJson('/pulse/cycles', 'POST', body);
      onCreated(cycle);
    } catch (e) {
      setError(e.message || 'Could not create cycle');
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: 24, width: 460, maxWidth: '90vw' }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Trigger a Pulse cycle</h3>
        <p style={{ ...muted, marginTop: 0 }}>Generates 3 tailored questions + a tip for you to vet.</p>

        <label style={{ fontSize: 12, fontWeight: 600 }}>Node install (optional)</label>
        <select value={installId} onChange={(e) => chooseInstall(e.target.value)} style={selStyle}>
          <option value="">— none / pick a slug below —</option>
          {installs.map((i) => (
            <option key={i.id} value={i.id}>{i.slug} · "{i.newsroom}" · v{i.nodeVersion || '?'}</option>
          ))}
        </select>

        <label style={{ fontSize: 12, fontWeight: 600 }}>Node slug</label>
        <input value={nodeSlug} onChange={(e) => setNodeSlug(e.target.value)} placeholder="e.g. analytics, verifier, podcasting" style={selStyle} />

        <label style={{ fontSize: 12, fontWeight: 600 }}>Newsroom {presetNewsroom ? '' : '(confirm the match)'}</label>
        <select value={newsroomId} onChange={(e) => setNewsroomId(e.target.value)} style={selStyle} disabled={!!presetNewsroom}>
          <option value="">— select a newsroom —</option>
          {newsrooms.map((n) => (
            <option key={n.id} value={n.id}>{n.name}{n.country ? ` · ${n.country}` : ''}</option>
          ))}
        </select>

        {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={create} disabled={busy || !newsroomId || !nodeSlug}>
            {busy ? 'Generating…' : 'Generate cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}

const selStyle = { width: '100%', padding: '8px 10px', margin: '4px 0 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13 };

export default function PulseOverview() {
  const [cycles, setCycles] = useState(null);
  const [newsrooms, setNewsrooms] = useState([]);
  const [installs, setInstalls] = useState([]);
  const [error, setError] = useState(null);
  const [trigger, setTrigger] = useState(null); // null | {presetNewsroom}
  const navigate = useNavigate();

  function load() {
    apiFetch('/pulse/cycles').then(setCycles).catch((e) => setError(e.message));
    apiFetch('/pulse/newsrooms').then(setNewsrooms).catch(() => {});
    apiFetch('/pulse/node-installs').then(setInstalls).catch(() => {});
  }
  useEffect(load, []);

  if (error) return (<div><PageHeader title="Pulse" /><div className="empty-state"><h3>{error}</h3></div></div>);
  if (!cycles) return (<div><PageHeader title="Pulse" /><p style={muted}>Loading…</p></div>);

  const active = cycles.filter((c) => ACTIVE.has(c.status));
  const awaitingPaul = cycles.filter((c) => c.status === 'Draft' || c.status === 'Plan drafted');
  const awaitingNewsroom = cycles.filter((c) => c.status === 'Sent');

  // Response rate over the last 30 days: of cycles that were sent, how many got a response.
  const cutoff = Date.now() - 30 * 86400000;
  const recentSent = cycles.filter((c) => SENT_OR_BEYOND.has(c.status) && new Date(c.triggeredDate).getTime() >= cutoff);
  const recentResponded = recentSent.filter((c) => RESPONDED_OR_BEYOND.has(c.status));
  const rate = recentSent.length ? Math.round((recentResponded.length / recentSent.length) * 100) : null;

  // Cohort cards: one per newsroom, summarising its cycles.
  const byNewsroom = new Map();
  for (const c of cycles) {
    const key = c.newsroomRecordId || c.newsroom;
    if (!byNewsroom.has(key)) byNewsroom.set(key, { name: c.newsroom, recordId: c.newsroomRecordId, cycles: [] });
    byNewsroom.get(key).cycles.push(c);
  }

  return (
    <div>
      <PageHeader title="Pulse" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -8, marginBottom: 20 }}>
        <p style={{ ...muted, margin: 0 }}>Cadenced feedback loop — turn newsroom answers into node changes.</p>
        <button className="btn btn-primary" onClick={() => setTrigger({})}>+ Trigger new cycle</button>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Stat label="Active cycles" value={active.length} sub="not reported back / cancelled" />
        <Stat label="Awaiting you" value={awaitingPaul.length} sub="vet questions / approve plan" />
        <Stat label="Awaiting newsroom" value={awaitingNewsroom.length} sub="sent, no response yet" />
        <Stat label="Response rate" value={rate == null ? '—' : `${rate}%`} sub="of sent cycles · last 30 days" />
      </div>

      {/* Active cycles table */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Active cycles <span style={muted}>· {active.length}</span></h3>
      {active.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 28 }}><h3>No active cycles. Trigger one above.</h3></div>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 28, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                {['Newsroom', 'Status', 'Triggered', 'Days idle', "What's blocking", ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.newsroom}<div style={{ ...muted, fontWeight: 400, fontFamily: 'monospace', fontSize: 11 }}>{c.nodeInstall}</div></td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: '10px 12px', ...muted }}>{fmtDate(c.triggeredDate)}</td>
                  <td style={{ padding: '10px 12px', ...muted, ...num }}>{c.daysSinceUpdate ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.blocking}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button className="btn btn-small btn-primary" onClick={() => navigate(`/admin/pulse/cycles/${c.id}`)}>{c.blocking === '—' ? 'Open' : c.blocking} →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cohort overview */}
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Newsrooms <span style={muted}>· {byNewsroom.size} with cycles</span></h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {[...byNewsroom.values()].map((nr) => {
          const sorted = [...nr.cycles].sort((a, b) => new Date(b.triggeredDate) - new Date(a.triggeredDate));
          const latest = sorted[0];
          return (
            <div key={nr.recordId || nr.name} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {nr.recordId
                  ? <Link to={`/admin/pulse/newsrooms/${nr.recordId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{nr.name}</Link>
                  : nr.name}
              </div>
              <div style={{ ...muted, marginBottom: 8 }}>{nr.cycles.length} cycle{nr.cycles.length === 1 ? '' : 's'} · last {fmtDate(latest?.triggeredDate)}</div>
              <div style={{ marginBottom: 12 }}><StatusBadge status={latest?.status} /></div>
              <button className="btn btn-small" onClick={() => setTrigger({ presetNewsroom: { id: nr.recordId, name: nr.name } })} disabled={!nr.recordId}>Trigger new cycle</button>
            </div>
          );
        })}
      </div>

      {trigger && (
        <TriggerModal
          presetNewsroom={trigger.presetNewsroom}
          newsrooms={newsrooms}
          installs={installs}
          onClose={() => setTrigger(null)}
          onCreated={(cycle) => { setTrigger(null); navigate(`/admin/pulse/cycles/${cycle.id}`); }}
        />
      )}
    </div>
  );
}
