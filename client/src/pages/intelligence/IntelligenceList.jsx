import { useState, useEffect } from 'react';
import { useSectors } from '../../context/SectorContext.jsx';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import SectorBadge from '../../components/SectorBadge.jsx';
import AiBadge from '../../components/AiBadge.jsx';

const CATEGORY_LABELS = {
  ai_tool: 'AI Tool', technique: 'Technique', framework: 'Framework',
  regulation: 'Regulation', use_case: 'Use Case', training_trend: 'Training Trend',
  competitor_move: 'Competitor',
};

export default function IntelligenceList() {
  const { selectedSectorId } = useSectors();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');

  function load() {
    let url = '/intelligence?';
    if (selectedSectorId) url += `sector_id=${selectedSectorId}&`;
    if (filter === 'actionable') url += 'actionable=true&';
    apiFetch(url).then(setItems).catch(() => setItems([]));
  }

  useEffect(load, [selectedSectorId, filter]);

  async function promoteToKnowledge(id) {
    await apiFetch(`/intelligence/${id}/knowledge`, { method: 'POST' });
    alert('Promoted to knowledge base');
  }

  async function markReviewed(id, action) {
    await apiFetch(`/intelligence/${id}`, { method: 'PUT', body: JSON.stringify({ action_taken: action }) });
    load();
  }

  return (
    <div>
      <PageHeader title="Industry Intelligence">
        <AiBadge />
      </PageHeader>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -8 }}>
        Live feed of AI developments relevant to your sectors — extracted from newsletters, research, and background jobs. Items here are raw signals before they become confirmed knowledge.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'actionable'].map(f => (
          <button key={f} className={`btn btn-small ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : 'Actionable'}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state"><h3>No intelligence items yet. Run the Industry Researcher background job to discover trends.</h3></div>
      ) : (
        items.map(item => (
          <div key={item.id} className="card" style={{ marginBottom: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span className="stage-badge stage-active" style={{ fontSize: 11 }}>{CATEGORY_LABELS[item.category] || item.category}</span>
                  {item.sector_name && <SectorBadge name={item.sector_name} />}
                  {item.is_actionable && !item.action_taken && <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>Actionable</span>}
                  {item.relevance_score && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Relevance: {Math.round(item.relevance_score * 100)}%</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.summary}</div>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'inline-block', marginTop: 4 }}>
                    {item.source_description || item.source_url} →
                  </a>
                )}
                {!item.source_url && item.source_description && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Source: {item.source_description}</div>
                )}
                {item.action_taken && <div style={{ fontSize: 12, marginTop: 6, color: '#10B981' }}>Action: {item.action_taken}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                <button className="btn btn-primary btn-small" onClick={() => promoteToKnowledge(item.id)} style={{ fontSize: 11 }}>
                  + Knowledge
                </button>
                {!item.action_taken && (
                  <button className="btn btn-secondary btn-small" onClick={() => markReviewed(item.id, 'Reviewed, noted')} style={{ fontSize: 11 }}>
                    Reviewed
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
