// Scraper Dashboard — one admin page to monitor (and kick off) every AI Legal
// scraper/pipeline. It consolidates what used to be five separate sidebar
// entries (Ingestion & Scrapers, Sources & Scraping, Lawsuit Tracker,
// Regulation Tracker, Use Cases) into a single monitor: status + counts +
// last-run for each, run buttons where the backend supports them, and an
// "Open →" link into the full detail page for everything else.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';

function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DOT = { healthy: '#10B981', degraded: '#F59E0B', broken: '#EF4444', idle: '#94A3B8', running: '#6366F1' };

function StatusDot({ status }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: DOT[status] || DOT.idle, flexShrink: 0 }} />;
}

// One metric in a tile (label left, value right).
function Metric({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// A dataset tile: header (status dot + title + Open link), metrics, then an
// optional action row (run button + feedback / last-run).
function Tile({ status, title, to, children, action }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <StatusDot status={status} />
          <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </div>
        <Link to={to} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 600 }}>Open →</Link>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      {action && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>{action}</div>}
    </div>
  );
}

// A button that POSTs to a run endpoint and shows inline progress/feedback.
function RunButton({ label, run, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const click = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await run();
      setMsg({ ok: true, text: r?.message || 'Started' });
      onDone?.();
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Failed' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button onClick={click} disabled={busy} className="btn btn-secondary" style={{ fontSize: 13, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}>
        {busy ? 'Running…' : label}
      </button>
      {msg && <span style={{ fontSize: 12, color: msg.ok ? '#059669' : '#DC2626' }}>{msg.text}</span>}
    </div>
  );
}

export default function ScraperDashboard() {
  const [sources, setSources] = useState(null);   // /legal-sources/stats
  const [health, setHealth] = useState(null);      // /legal-sources/health
  const [lawsuits, setLawsuits] = useState(null);  // /lawsuits/stats
  const [scan, setScan] = useState(null);          // /lawsuits/scan-status
  const [regs, setRegs] = useState(null);          // /regulations/stats
  const [useCases, setUseCases] = useState(null);  // /usecases
  const [overview, setOverview] = useState(null);  // /content-sources/overview

  const loadAll = useCallback(() => {
    apiFetch('/legal-sources/stats').then(setSources).catch(() => {});
    apiFetch('/legal-sources/health').then(setHealth).catch(() => {});
    apiFetch('/lawsuits/stats').then(setLawsuits).catch(() => {});
    apiFetch('/regulations/stats').then(setRegs).catch(() => {});
    apiFetch('/usecases').then(setUseCases).catch(() => {});
    apiFetch('/content-sources/overview').then(setOverview).catch(() => {});
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll the live lawsuit scan so the tile reflects an in-progress run.
  useEffect(() => {
    let alive = true;
    const tick = () => apiFetch('/lawsuits/scan-status').then(s => { if (alive) setScan(s); }).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const sStats = sources?.sources;
  const hCounts = health?.counts;
  const sourceStatus = scan?.running ? 'running'
    : hCounts?.broken ? 'broken'
    : hCounts?.degraded ? 'degraded'
    : sStats ? 'healthy' : 'idle';

  const ucList = Array.isArray(useCases) ? useCases : [];
  const ucPublished = ucList.filter(u => u.is_published).length;

  // Aggregate the content-sources overview into one ingestion summary.
  const domains = overview?.domains || [];
  const agg = domains.reduce((a, d) => ({
    active: a.active + (d.sources?.active || 0),
    total: a.total + (d.sources?.total || 0),
    comingIn: a.comingIn + (d.comingIn || 0),
    toUsers: a.toUsers + (d.toUsers || 0),
    toRag: a.toRag + (d.toRag || 0),
  }), { active: 0, total: 0, comingIn: 0, toUsers: 0, toRag: 0 });

  return (
    <div>
      <PageHeader title="Scraper Dashboard">
        <button onClick={loadAll} className="btn btn-secondary" style={{ fontSize: 13 }}>Refresh</button>
      </PageHeader>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: -8, marginBottom: 24 }}>
        Monitor and run every AI Legal scraper and pipeline in one place. Open any tile for the full tools.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

        {/* Sources & Scraping */}
        <Tile status={sourceStatus} title="Sources & Scraping" to="/legal-sources"
          action={<RunButton label="Run all due" run={() => apiFetch('/legal-sources/run-all-due', { method: 'POST' })} onDone={loadAll} />}>
          {sStats ? (
            <>
              <Metric label="Active sources" value={`${sStats.active}/${sStats.total}`} />
              <Metric label="New items" value={sStats.items_new ?? 0} accent="#D97706" />
              <Metric label="Promoted" value={sStats.items_promoted ?? 0} accent="#059669" />
              {hCounts && <Metric label="Health" value={`${hCounts.healthy || 0} ok · ${hCounts.degraded || 0} degraded · ${hCounts.broken || 0} broken`} />}
            </>
          ) : <Metric label="Status" value="Loading…" />}
        </Tile>

        {/* Lawsuit Tracker */}
        <Tile status={scan?.running ? 'running' : (lawsuits ? 'healthy' : 'idle')} title="Lawsuit Tracker" to="/lawsuits"
          action={<RunButton label="Run scan" run={() => apiFetch('/lawsuits/refresh', { method: 'POST' })} onDone={loadAll} />}>
          {lawsuits ? (
            <>
              <Metric label="Total cases" value={lawsuits.total ?? 0} />
              <Metric label="Active" value={lawsuits.active ?? 0} accent="#1D4ED8" />
              <Metric label="Updated" value={timeAgo(lawsuits.last_updated)} />
              {scan?.running && <Metric label="Scanning" value={`${scan.phase || ''} ${scan.articlesTotal ? `${scan.articlesDone}/${scan.articlesTotal}` : ''}`.trim()} accent="#6366F1" />}
            </>
          ) : <Metric label="Status" value="Loading…" />}
        </Tile>

        {/* Regulation Tracker — no dedicated scrape endpoint; fed via Sources. */}
        <Tile status={regs ? 'healthy' : 'idle'} title="Regulation Tracker" to="/regulation-tracker">
          {regs ? (
            <>
              <Metric label="Total" value={regs.total ?? 0} />
              <Metric label="In force" value={regs.in_force ?? 0} accent="#065F46" />
              <Metric label="Proposed" value={regs.proposed ?? 0} accent="#075985" />
              <Metric label="Updated" value={timeAgo(regs.last_updated)} />
            </>
          ) : <Metric label="Status" value="Loading…" />}
        </Tile>

        {/* Use Cases — no scrape endpoint; managed in its own page. */}
        <Tile status={useCases ? 'healthy' : 'idle'} title="Use Cases" to="/use-cases-admin">
          {useCases ? (
            <>
              <Metric label="Total" value={ucList.length} />
              <Metric label="Published" value={ucPublished} accent="#059669" />
              <Metric label="Drafts" value={ucList.length - ucPublished} accent="#D97706" />
            </>
          ) : <Metric label="Status" value="Loading…" />}
        </Tile>

        {/* Ingestion & Scrapers — the cross-domain pipeline overview. */}
        <Tile status={overview ? 'healthy' : 'idle'} title="Ingestion & Scrapers" to="/ingestion"
          action={<RunButton label="Run due (all)" run={() => apiFetch('/content-sources/run-due', { method: 'POST' })} onDone={loadAll} />}>
          {overview ? (
            <>
              <Metric label="Active sources" value={`${agg.active}/${agg.total}`} />
              <Metric label="Coming in" value={agg.comingIn} accent="#D97706" />
              <Metric label="→ Users" value={agg.toUsers} accent="#059669" />
              <Metric label="→ RAG model" value={agg.toRag} accent="#7C3AED" />
            </>
          ) : <Metric label="Status" value="Loading…" />}
        </Tile>

      </div>
    </div>
  );
}
