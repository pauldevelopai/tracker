import { useState, useEffect } from 'react';
import { apiFetch } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import AiBadge from '../../components/AiBadge.jsx';

const CATEGORY_LABELS = {
  ai_tool: 'AI Tool', regulation: 'Regulation', technique: 'Technique',
  use_case: 'Use Case', industry_news: 'Industry News', opinion: 'Opinion',
  training_trend: 'Training Trend', framework: 'Framework',
};

const KNOWLEDGE_TAGS = [
  { value: 'research', label: 'Research', color: '#6366F1' },
  { value: 'tools', label: 'Tools', color: '#10B981' },
  { value: 'policy', label: 'Policy', color: '#EF4444' },
  { value: 'ethics', label: 'Ethics', color: '#8B5CF6' },
  { value: 'industry_news', label: 'Industry News', color: '#94A3B8' },
  { value: 'curriculum', label: 'Curriculum', color: '#3B82F6' },
  { value: 'security', label: 'Security', color: '#F59E0B' },
  { value: 'legal', label: 'Legal', color: '#EC4899' },
];

const CATEGORY_COLORS = {
  ai_tool: '#6366F1', regulation: '#EF4444', technique: '#10B981',
  use_case: '#F59E0B', industry_news: '#94A3B8', opinion: '#8B5CF6',
  training_trend: '#3B82F6', framework: '#EC4899',
};

const BRIEFING_FILTERS = [
  {
    key: 'legal',
    label: 'Legal Cases & Frameworks',
    color: '#EC4899',
    categories: ['regulation', 'framework'],
    keywords: ['legal', 'law', 'court', 'legislation', 'regulation', 'gdpr', 'eu ai act', 'compliance', 'liability', 'lawsuit', 'judgment'],
  },
  {
    key: 'ethics',
    label: 'Ethics & AI',
    color: '#8B5CF6',
    categories: ['opinion'],
    keywords: ['ethics', 'ethical', 'bias', 'fairness', 'responsible', 'transparency', 'accountability', 'harm', 'trust', 'safety'],
  },
  {
    key: 'security',
    label: 'Data Security & AI',
    color: '#F59E0B',
    categories: [],
    keywords: ['security', 'privacy', 'breach', 'vulnerability', 'data protection', 'cybersecurity', 'hack', 'phishing', 'encryption', 'gdpr'],
  },
  {
    key: 'workflows',
    label: 'Workflows & Tools',
    color: '#10B981',
    categories: ['ai_tool', 'technique', 'use_case'],
    keywords: ['workflow', 'tool', 'build', 'automation', 'pipeline', 'integrate', 'productivity', 'agent', 'prompt', 'agentic'],
  },
];

function itemMatchesFilter(item, filter) {
  if (filter.categories.includes(item.category)) return true;
  const text = `${item.subject || ''} ${item.summary || ''}`.toLowerCase();
  return filter.keywords.some(kw => text.includes(kw));
}

export default function NewsletterDigest() {
  const [activeTab, setActiveTab] = useState('digest');
  const [items, setItems] = useState([]);
  const [digest, setDigest] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [settings, setSettings] = useState({});
  const [archive, setArchive] = useState([]);

  function loadDigest() {
    apiFetch(`/newsletter/digest/${selectedDate}`).then(d => {
      setDigest(d.digest);
      setItems(d.items || []);
    }).catch(() => { setDigest(null); setItems([]); });
  }

  function loadCurriculum() {
    apiFetch('/newsletter/curriculum').then(setItems).catch(() => setItems([]));
  }

  function loadSettings() {
    apiFetch('/newsletter/settings').then(setSettings).catch(() => {});
  }

  function loadArchive() {
    apiFetch('/newsletter/archive').then(setArchive).catch(() => setArchive([]));
  }

  useEffect(() => {
    loadSettings();
    // Load archive and auto-select the most recent date with data
    apiFetch('/newsletter/archive').then(a => {
      setArchive(a);
      if (a.length > 0 && a[0].digest_date) {
        setSelectedDate(a[0].digest_date.split('T')[0]);
      }
    }).catch(() => setArchive([]));
  }, []);
  useEffect(() => {
    if (activeTab === 'digest') loadDigest();
    else if (activeTab === 'curriculum') loadCurriculum();
  }, [activeTab, selectedDate]);

  async function promoteToKnowledge(id, tags) {
    await apiFetch(`/newsletter/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });
    if (activeTab === 'digest') loadDigest(); else loadCurriculum();
  }

  async function toggleCurriculum(item) {
    await apiFetch(`/newsletter/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_curriculum_relevant: !item.is_curriculum_relevant }),
    });
    if (activeTab === 'digest') loadDigest(); else loadCurriculum();
  }

  const [activeFilters, setActiveFilters] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'email' | 'web'
  const [storiesPerDay, setStoriesPerDay] = useState(10);
  const [fetchingWeb, setFetchingWeb] = useState(false);

  function toggleFilter(key) {
    setActiveFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function applyFilters(itemList) {
    let list = itemList;
    // Source filter
    if (sourceFilter === 'email') list = list.filter(i => !i.source_type || i.source_type === 'email');
    else if (sourceFilter === 'web') list = list.filter(i => i.source_type === 'web');
    // Topic filters
    if (activeFilters.length > 0) {
      list = list.filter(item =>
        activeFilters.some(key => {
          const filter = BRIEFING_FILTERS.find(f => f.key === key);
          return filter && itemMatchesFilter(item, filter);
        })
      );
    }
    return list;
  }

  async function fetchWebNews() {
    setFetchingWeb(true);
    try {
      const result = await apiFetch('/newsletter/fetch-web', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
        timeout: 300000,
      });
      alert(`Web fetch complete: ${result.inserted} new stories added.`);
      loadDigest();
    } catch (err) {
      alert('Web fetch failed: ' + err.message);
    } finally {
      setFetchingWeb(false);
    }
  }

  const [regenerating, setRegenerating] = useState(false);
  const [editingDigest, setEditingDigest] = useState(false);
  const [editedDigest, setEditedDigest] = useState('');
  const [publishing, setPublishing] = useState(false);

  function startEditDigest() {
    setEditedDigest(digest || '');
    setEditingDigest(true);
  }

  function saveDigestEdit() {
    setDigest(editedDigest);
    setEditingDigest(false);
    // Persist to archive table
    apiFetch(`/newsletter/digest/${selectedDate}`, {
      method: 'PUT',
      body: JSON.stringify({ content: editedDigest }),
    }).catch(() => {});
  }

  async function publishTo(platform) {
    const content = digest || '';
    if (!content) return alert('No digest to publish');
    setPublishing(true);
    try {
      // Create a social post draft with the digest content
      await apiFetch('/social-posts', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          content: platform === 'linkedin'
            ? content.replace(/─+/g, '').replace(/\n{3,}/g, '\n\n').trim()
            : content,
          status: 'draft',
          ai_generated: true,
        }),
      });
      alert(`Draft created for ${platform}. Go to Marketing > Social Content to review and publish.`);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function regenerateDigest() {
    setRegenerating(true);
    try {
      const result = await apiFetch('/newsletter/regenerate-digest', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate, storiesLimit: storiesPerDay, sourceFilter }),
        timeout: 300000,
      });
      setDigest(result.digest);
      loadArchive(); // refresh archive list
    } catch (err) {
      alert('Regeneration failed: ' + err.message);
    } finally {
      setRegenerating(false);
    }
  }

  // Apply all filters, then enforce stories-per-day cap (curriculum items take priority)
  const filteredCurriculum = applyFilters(items.filter(i => i.is_curriculum_relevant));
  const filteredOther = applyFilters(items.filter(i => !i.is_curriculum_relevant));
  const totalFiltered = [...filteredCurriculum, ...filteredOther];
  const cappedTotal = totalFiltered.slice(0, storiesPerDay);
  const curriculumInDigest = cappedTotal.filter(i => i.is_curriculum_relevant);
  const digestItems = cappedTotal.filter(i => !i.is_curriculum_relevant);

  return (
    <div>
      <PageHeader title="Newsletter">
        <AiBadge />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gmail label: {settings.label || 'Newsletters'}</span>
      </PageHeader>

      <div className="tabs">
        <button className={`tab ${activeTab === 'digest' ? 'active' : ''}`} onClick={() => setActiveTab('digest')}>
          Daily Briefing
        </button>
        <button className={`tab ${activeTab === 'curriculum' ? 'active' : ''}`} onClick={() => setActiveTab('curriculum')}>
          Curriculum Items ({activeTab === 'curriculum' ? items.length : curriculumInDigest.length})
        </button>
        <button className={`tab ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')}>
          Past Briefings ({archive.length})
        </button>
      </div>

      {activeTab === 'digest' && (
        <div>
          {/* Date picker + regenerate */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: 13 }}
            />
            <button className="btn btn-secondary btn-small" onClick={regenerateDigest} disabled={regenerating}>
              {regenerating ? 'Regenerating...' : 'Regenerate Briefing'}
            </button>
          </div>

          {/* Source + topic filters + stories control */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
            {/* Row 1: Source toggles + stories per day + fetch web */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 52 }}>Source:</span>
              {[['all', 'All'], ['email', 'Email'], ['web', 'Web']].map(([val, label]) => (
                <button key={val} onClick={() => setSourceFilter(val)} style={{
                  fontSize: 12, padding: '4px 12px', borderRadius: 16,
                  border: `1.5px solid ${sourceFilter === val ? 'var(--accent)' : 'var(--border-color)'}`,
                  background: sourceFilter === val ? 'var(--accent)' : 'transparent',
                  color: sourceFilter === val ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: sourceFilter === val ? 600 : 400,
                  transition: 'all 0.15s',
                }}>{label}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Stories:</span>
                <input
                  type="number" min={3} max={10} value={storiesPerDay}
                  onChange={e => setStoriesPerDay(Math.min(10, Math.max(3, parseInt(e.target.value) || 3)))}
                  style={{ width: 52, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'center' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>per day</span>
                <button className="btn btn-secondary btn-small" onClick={fetchWebNews} disabled={fetchingWeb} style={{ fontSize: 11, marginLeft: 4 }}>
                  {fetchingWeb ? 'Fetching...' : '+ Fetch Web'}
                </button>
              </div>
            </div>
            {/* Row 2: Topic filters */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 52 }}>Topic:</span>
              {BRIEFING_FILTERS.map(f => {
                const active = activeFilters.includes(f.key);
                return (
                  <button key={f.key} onClick={() => toggleFilter(f.key)} style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 16,
                    border: `1.5px solid ${active ? f.color : 'var(--border-color)'}`,
                    background: active ? f.color : 'transparent',
                    color: active ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>{f.label}</button>
                );
              })}
              {activeFilters.length > 0 && (
                <button onClick={() => setActiveFilters([])} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 12,
                  border: '1px solid var(--border-color)', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}>Clear</button>
              )}
            </div>
          </div>

          {/* Digest summary */}
          {digest && (
            <div className="card" style={{ marginBottom: 20, padding: 20, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AiBadge />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Morning Briefing</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-small" onClick={editingDigest ? saveDigestEdit : startEditDigest} style={{ fontSize: 11 }}>
                    {editingDigest ? 'Save' : 'Edit'}
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => publishTo('linkedin')} disabled={publishing} style={{ fontSize: 11 }}>
                    → LinkedIn
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => publishTo('substack')} disabled={publishing} style={{ fontSize: 11 }}>
                    → Substack
                  </button>
                </div>
              </div>
              {editingDigest ? (
                <div>
                  <textarea value={editedDigest} onChange={e => setEditedDigest(e.target.value)}
                    rows={20} style={{ width: '100%', fontSize: 14, lineHeight: 1.7, padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontFamily: 'inherit', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-primary btn-small" onClick={saveDigestEdit}>Save Changes</button>
                    <button className="btn btn-secondary btn-small" onClick={() => setEditingDigest(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: (() => {
                    let text = digest;
                    // 1. Strip ALL HTML tags completely, preserving href URLs as markdown
                    text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');
                    text = text.replace(/<[^>]+>/g, ''); // nuke any remaining HTML
                    // 2. Fix malformed patterns like: https://url" target... → just the URL
                    text = text.replace(/(https?:\/\/[^\s"]+)"[^)]*\)/g, '$1');
                    // 3. Convert markdown links [text](url) → clickable HTML
                    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
                      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #6366F1; text-decoration: underline">$1</a>');
                    // 4. Convert remaining bare URLs → clickable
                    text = text.replace(/(?<!href=")(https?:\/\/[^\s<)"]+)/g,
                      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #6366F1; text-decoration: underline; word-break: break-all">$1</a>');
                    return text;
                  })() }} />
              )}
            </div>
          )}

          {/* Curriculum-relevant items first */}
          {curriculumInDigest.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>
                Curriculum-Relevant ({curriculumInDigest.length})
              </h3>
              {curriculumInDigest.map(item => <NewsItem key={item.id} item={item} onPromote={promoteToKnowledge} onToggle={toggleCurriculum} />)}
            </div>
          )}

          {/* Other items */}
          {digestItems.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                Other Items ({digestItems.length})
              </h3>
              {digestItems.map(item => <NewsItem key={item.id} item={item} onPromote={promoteToKnowledge} onToggle={toggleCurriculum} />)}
            </div>
          )}

          {items.length === 0 && !digest && (
            <div className="empty-state">
              <h3>No newsletter items for this date.</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Run the Newsletter Digest background job from Settings to process your newsletters.
              </p>
            </div>
          )}
          {items.length > 0 && activeFilters.length > 0 && digestItems.length === 0 && curriculumInDigest.length === 0 && (
            <div className="empty-state">
              <h3>No items match the selected filters.</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Try selecting different filters or clear them to see all items.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'curriculum' && (
        <div>
          {items.length === 0 ? (
            <div className="empty-state"><h3>No curriculum-relevant items found yet.</h3></div>
          ) : (
            items.map(item => <NewsItem key={item.id} item={item} onPromote={promoteToKnowledge} onToggle={toggleCurriculum} showDate />)
          )}
        </div>
      )}

      {activeTab === 'archive' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Past Briefings</h3>
          {archive.length === 0 ? (
            <div className="empty-state"><h3>No past briefings yet.</h3></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Items</th><th>Curriculum</th><th></th></tr>
              </thead>
              <tbody>
                {archive.map(a => (
                  <tr key={a.digest_date} style={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedDate(a.digest_date); setActiveTab('digest'); }}>
                    <td style={{ fontWeight: 500 }}>{new Date(a.digest_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                    <td>{a.item_count} items</td>
                    <td>{a.curriculum_count > 0 ? <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{a.curriculum_count} curriculum</span> : '—'}</td>
                    <td><span style={{ fontSize: 12, color: 'var(--accent)' }}>View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function NewsItem({ item, onPromote, onToggle, showDate }) {
  const [tagging, setTagging] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);

  function toggleTag(tag) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function confirmPromote() {
    await onPromote(item.id, selectedTags);
    setTagging(false);
    setSelectedTags([]);
  }

  return (
    <div className="card" style={{
      marginBottom: 6, padding: 14,
      borderLeft: item.is_curriculum_relevant ? '3px solid var(--accent)' : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
              background: CATEGORY_COLORS[item.category] || '#94A3B8', color: 'white',
            }}>{CATEGORY_LABELS[item.category] || item.category}</span>
            {item.is_curriculum_relevant && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>CURRICULUM</span>}
            {item.relevant_sectors?.length > 0 && item.relevant_sectors.map(s => (
              <span key={s} style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s}</span>
            ))}
            {showDate && item.received_at && (
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{new Date(item.received_at).toLocaleDateString()}</span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.subject}</div>
          {item.summary && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.summary}</div>}
          {item.curriculum_relevance_reason && (
            <div style={{ fontSize: 12, marginTop: 4, padding: '4px 8px', background: '#EEF2FF', borderRadius: 4, color: 'var(--accent)' }}>
              {item.curriculum_relevance_reason}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.source_url ? (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1', textDecoration: 'underline' }}>{item.sender}</a>
            ) : (
              <span>{item.sender}</span>
            )}
            {item.received_at && <span style={{ color: '#94A3B8' }}>•</span>}
            {item.received_at && <span>{new Date(item.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          </div>
          {/* Tag picker */}
          {tagging && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#F8FAFC', borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Select knowledge tags:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {KNOWLEDGE_TAGS.map(tag => (
                  <button key={tag.value} onClick={() => toggleTag(tag.value)} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 12, border: '1.5px solid',
                    borderColor: selectedTags.includes(tag.value) ? tag.color : '#D1D5DB',
                    background: selectedTags.includes(tag.value) ? tag.color : 'white',
                    color: selectedTags.includes(tag.value) ? 'white' : '#374151',
                    cursor: 'pointer', fontWeight: selectedTags.includes(tag.value) ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>
                    {tag.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-small" onClick={confirmPromote} style={{ fontSize: 11 }}>
                  Add to Knowledge {selectedTags.length > 0 ? `(${selectedTags.length} tags)` : ''}
                </button>
                <button className="btn btn-secondary btn-small" onClick={() => { setTagging(false); setSelectedTags([]); }} style={{ fontSize: 11 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
          {item.is_curriculum_relevant && !item.promoted_to_knowledge && !tagging && (
            <button className="btn btn-primary btn-small" onClick={() => setTagging(true)} style={{ fontSize: 10 }}>
              + Knowledge
            </button>
          )}
          {item.promoted_to_knowledge && (
            <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>✓ Knowledge</span>
          )}
          <button className="btn btn-secondary btn-small" onClick={() => onToggle(item)} style={{ fontSize: 10 }}>
            {item.is_curriculum_relevant ? 'Not Curriculum' : 'Mark Curriculum'}
          </button>
        </div>
      </div>
    </div>
  );
}
