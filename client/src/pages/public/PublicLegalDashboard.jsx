// AI Policies dashboard — one public page that pulls the latest from every
// section of the "AI Policies" menu (Lawsuits, Regulations, Use cases, Ethics)
// so a reader can scan it all in one place instead of clicking through. Data
// comes from a single /public/overview call (counts + recent per section).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicFetch } from '../../hooks/usePublicApi.js';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// One section column: header (count + "view all" link) and a list of recent rows.
function Section({ title, count, to, viewAll, children }) {
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
          {typeof count === 'number' && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{count}</span>
          )}
        </div>
        <Link to={to} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>{viewAll} →</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

// A single recent row: title (optional link), a one-line meta, optional summary.
function Row({ to, href, title, meta, summary }) {
  const inner = (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        {meta && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{meta}</span>}
      </div>
      {summary && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{summary}</div>}
    </>
  );
  const style = { textDecoration: 'none', color: 'inherit', display: 'block' };
  if (to) return <Link to={to} style={style}>{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" style={style}>{inner}</a>;
  return <div style={style}>{inner}</div>;
}

const Empty = () => <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing yet.</div>;

export default function PublicLegalDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    publicFetch('/public/overview').then(setData).catch(() => setErr(true));
  }, []);

  const d = data || {};
  return (
    <div>
      <section style={{ marginBottom: 28, maxWidth: 760 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
          AI Policies &middot; Dashboard
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 14px 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Everything in one place
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          The latest from across the AI Policies tracker — lawsuits, regulations, real newsroom use cases and
          ethics resources — without clicking through each section.
        </p>
      </section>

      {err && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Couldn’t load the dashboard right now. Please try again.</div>}
      {!data && !err && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading…</div>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Section title="Lawsuits" count={d.lawsuits?.count} to="/legal/lawsuits" viewAll="All lawsuits">
            {(d.lawsuits?.recent || []).length === 0 ? <Empty /> : d.lawsuits.recent.map(c => (
              <Row key={c.id} to={`/legal/lawsuits/${c.id}`} title={c.case_name}
                   meta={[c.jurisdiction, c.status, fmtDate(c.updated_at)].filter(Boolean).join(' · ')}
                   summary={c.summary} />
            ))}
          </Section>

          <Section title="Regulations" count={d.regulations?.count} to="/legal/regulations" viewAll="All regulations">
            {(d.regulations?.recent || []).length === 0 ? <Empty /> : d.regulations.recent.map(r => (
              <Row key={r.id} to={`/legal/regulations/${r.id}`} title={r.title}
                   meta={[r.jurisdiction, r.status, fmtDate(r.updated_at)].filter(Boolean).join(' · ')}
                   summary={r.summary} />
            ))}
          </Section>

          <Section title="Use cases" count={d.useCases?.count} to="/legal/use-cases" viewAll="All use cases">
            {(d.useCases?.recent || []).length === 0 ? <Empty /> : d.useCases.recent.map(u => (
              <Row key={u.id} to={`/legal/use-cases/${u.id}`} title={u.use_case_title || u.firm_name}
                   meta={[u.firm_name, u.jurisdiction, fmtDate(u.updated_at)].filter(Boolean).join(' · ')}
                   summary={u.summary} />
            ))}
          </Section>

          <Section title="Ethics" count={d.ethics?.count} to="/legal/ethics" viewAll="Ethics guide">
            {(d.ethics?.recent || []).length === 0 ? <Empty /> : d.ethics.recent.map(e => (
              <Row key={e.id} href={e.url} title={e.title}
                   meta={[e.item_type, e.source_name, fmtDate(e.updated_at)].filter(Boolean).join(' · ')}
                   summary={e.summary} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
