// Public AI Toolkit page — imported from the aikit_bundle catalogue.
// List of tools with category filter, search, and per-tool detail view.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicFetch } from '../../hooks/usePublicApi.js';
import { ChipTag, inputStyle } from './publicHelpers.jsx';

function CdiBadge({ label, value }) {
  if (value === null || value === undefined) return null;
  // Lower is better for Cost and Invasiveness; lower Difficulty = easier.
  const color = value <= 3 ? '#10B981' : value <= 6 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>/ 10</div>
    </div>
  );
}

function ToolCard({ t, onSelect }) {
  return (
    <div
      className="card"
      onClick={onSelect}
      style={{
        padding: '14px 16px', cursor: 'pointer',
        borderLeft: '3px solid #6366F1',
      }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        {t.primary_category && <ChipTag>{t.primary_category}</ChipTag>}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
      {t.description && (
        <div style={{
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {t.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center' }}>
        <CdiBadge label="Cost" value={t.cdi_cost} />
        <CdiBadge label="Difficulty" value={t.cdi_difficulty} />
        <CdiBadge label="Invasiveness" value={t.cdi_invasiveness} />
      </div>
    </div>
  );
}

function ToolDetail({ slug, onBack }) {
  const [tool, setTool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    publicFetch(`/public/toolkit/${slug}`)
      .then(setTool)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>;
  if (error) return <div style={{ color: '#991B1B' }}>{error}</div>;
  if (!tool) return null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <a href="/legal/tools" onClick={e => { e.preventDefault(); onBack(); }}
           style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>← All tools</a>
      </div>

      <div className="card" style={{ padding: '20px 24px', borderLeft: '3px solid #6366F1' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {tool.primary_category && <ChipTag>{tool.primary_category}</ChipTag>}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
          {tool.name}
        </h1>
        {tool.url && (
          <a href={tool.url} target="_blank" rel="noreferrer"
             style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
            {tool.url} ↗
          </a>
        )}

        {(tool.cdi_cost !== null || tool.cdi_difficulty !== null || tool.cdi_invasiveness !== null) && (
          <div style={{ marginTop: 18, padding: '14px 16px', background: '#F9FAFB', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              CDI Score · Cost / Difficulty / Invasiveness (lower is better)
            </div>
            <div style={{ display: 'flex', gap: 32, justifyContent: 'flex-start' }}>
              <CdiBadge label="Cost" value={tool.cdi_cost} />
              <CdiBadge label="Difficulty" value={tool.cdi_difficulty} />
              <CdiBadge label="Invasiveness" value={tool.cdi_invasiveness} />
            </div>
          </div>
        )}

        {tool.description && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Description
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>{tool.description}</div>
          </div>
        )}

        {tool.purpose && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Purpose
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>{tool.purpose}</div>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-secondary)' }}>
          Imported from the AI Editorial Toolkit catalogue.
        </div>
      </div>
    </div>
  );
}

export default function PublicTools({ mode = 'list' }) {
  const navigate = useNavigate();
  const params = useParams();
  const slugFromRoute = params.slug;

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('q', search);
    if (filterCategory !== 'all') p.set('category', filterCategory);
    setLoading(true);
    publicFetch(`/public/toolkit?${p}`)
      .then(res => { setItems(res.items || []); setCategories(res.categories || []); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, filterCategory]);

  useEffect(() => { if (mode === 'list') load(); }, [load, mode]);

  if (mode === 'detail') {
    return <ToolDetail slug={slugFromRoute} onBack={() => navigate('/legal/tools')} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
          AI tools for journalism & investigation
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 760, lineHeight: 1.6, margin: 0 }}>
          Curated catalogue of AI tools rated on Cost, Difficulty and Invasiveness.
          Imported from the Develop AI Editorial Toolkit.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="text" placeholder="Search tools…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
          <option value="all">All categories ({items.length})</option>
          {categories.map(c => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
        {items.length} tool{items.length === 1 ? '' : 's'}
      </div>

      {loading && <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
      {error   && <div style={{ color: '#991B1B' }}>{error}</div>}
      {!loading && items.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>No tools match these filters.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {items.map(t => (
          <ToolCard key={t.slug} t={t} onSelect={() => navigate(`/legal/tools/${t.slug}`)} />
        ))}
      </div>
    </div>
  );
}
