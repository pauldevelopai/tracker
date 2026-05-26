// Home: represents the whole of Grounded — newsroom-owned AI tools (Nodes),
// the public AI Legal tracker, and the wider toolkit — then a live teaser of
// the latest legal-tracker activity. The full per-type lists live under
// /legal/lawsuits and /legal/regulations.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicFetch } from '../../hooks/usePublicApi.js';
import {
  LAWSUIT_EVENT_STYLES, REG_EVENT_STYLES,
  ChipTag, formatDate, timeAgo,
} from './publicHelpers.jsx';
import WatchButton from './WatchButton.jsx';

const PILLARS = [
  {
    tag: 'Nodes',
    title: 'AI tools your newsroom runs and owns',
    body: 'Small, sharp tools built with newsrooms — like Audience Signal, which reads your own published-story performance and shows what your audience actually rewards. Run it on your computer with one command, or use it online.',
    cta: 'Explore Nodes',
    href: '/nodes/',
    external: true,
  },
  {
    tag: 'AI Legal',
    title: 'Track AI in court and regulation',
    body: 'A chronological, sourced feed of every significant AI lawsuit and regulation worldwide — and how they connect. Free and open to everyone.',
    cta: 'Open the tracker',
    href: '/legal/lawsuits',
    external: false,
  },
  {
    tag: 'Tools',
    title: 'A growing AI toolkit',
    body: 'Focused AI tools for everyday newsroom work, in one place — added to as real needs come up.',
    cta: 'Browse tools',
    href: '/tools/',
    external: true,
  },
];

export default function PublicHome() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicFetch('/public/feed?limit=8')
      .then(res => setFeed(Array.isArray(res) ? res : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Grounded · by Develop AI
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, margin: '0 0 14px 0', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
          Newsroom-owned AI
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 760, lineHeight: 1.6, margin: 0 }}>
          Grounded builds small AI tools that newsrooms run, own, and adapt — on their own
          data, on their own machines. And we track, in the open, how AI is being fought over
          in courts and parliaments around the world.
        </p>
      </section>

      {/* ── Three pillars ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 36 }}>
        {PILLARS.map(p => (
          <div key={p.tag} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {p.tag}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{p.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 16px 0', flex: 1 }}>{p.body}</p>
            {p.external
              ? <a href={p.href} style={ctaStyle}>{p.cta} &rarr;</a>
              : <Link to={p.href} style={ctaStyle}>{p.cta} &rarr;</Link>}
          </div>
        ))}
      </section>

      {/* ── Latest from the legal tracker + digest ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Latest from the AI Legal tracker
          </div>
          <Link to="/legal/lawsuits" style={{ ...ctaStyle, fontSize: 13 }}>See the full tracker &rarr;</Link>
        </div>

        {loading && <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
        {error && <div style={{ color: '#991B1B' }}>{error}</div>}
        {!loading && !error && feed.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No tracked events yet.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {feed.map(ev => <FeedItem key={`${ev.type}:${ev.event_id}`} ev={ev} />)}
        </div>

        <div style={{ marginTop: 18, padding: 14, border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 10, background: 'var(--card-bg, #fff)', maxWidth: 520 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Weekly digest</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Every Monday, a summary of the week's AI legal movements by email. No spam. Unsubscribe any time.
          </div>
          <WatchButton entityKind="all" label="Subscribe to weekly digest" />
        </div>
      </section>
    </div>
  );
}

function FeedItem({ ev }) {
  const isLawsuit = ev.type === 'lawsuit_event';
  const style = (isLawsuit ? LAWSUIT_EVENT_STYLES : REG_EVENT_STYLES)[ev.event_type] || { color: '#64748B', icon: '•' };
  const href = isLawsuit ? `/legal/lawsuits/${ev.item_id}` : `/legal/regulations/${ev.item_id}`;

  return (
    <Link to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{
        padding: '12px 14px', borderLeft: `3px solid ${style.color}`,
        display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
      }}>
        <div style={{
          minWidth: 26, height: 26, borderRadius: '50%',
          background: style.color, color: 'white', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{style.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
            <ChipTag>{isLawsuit ? 'Lawsuit' : 'Regulation'}</ChipTag>
            <ChipTag>{ev.jurisdiction}</ChipTag>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {ev.event_type.replace(/_/g, ' ')}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{formatDate(ev.date) || '—'}</span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>({timeAgo(ev.date)})</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ev.title || ev.item_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.item_name}</div>
          {ev.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {ev.description}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

const ctaStyle = { color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', fontSize: 14 };
