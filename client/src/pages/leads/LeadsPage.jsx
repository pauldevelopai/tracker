import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectors } from '../../context/SectorContext.jsx';
import { apiFetch, buildUrl } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import DataTable from '../../components/DataTable.jsx';
import SectorBadge from '../../components/SectorBadge.jsx';
import AiBadge from '../../components/AiBadge.jsx';
import AgentChatPanel from '../../components/AgentChatPanel.jsx';

const PIPELINE_STAGES = ['prospect', 'contacted', 'meeting', 'proposal', 'client'];
const STAGE_COLORS = {
  prospect: '#94A3B8', contacted: '#6366F1', meeting: '#F59E0B', proposal: '#10B981', client: '#059669',
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const { selectedSectorId } = useSectors();
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [stageFilter, setStageFilter] = useState('');
  const [mining, setMining] = useState(false);
  const [mineResult, setMineResult] = useState('');

  function load() {
    apiFetch(buildUrl('/contacts', selectedSectorId)).then(data => {
      // Only show leads (prospect through proposal, or source=email_mining)
      setContacts(data.filter(c => ['prospect', 'contacted', 'meeting', 'proposal'].includes(c.pipeline_stage) || c.source === 'email_mining'));
    }).catch(() => setContacts([]));
  }

  useEffect(load, [selectedSectorId]);

  async function runLeadMiner() {
    setMining(true);
    setMineResult('');
    try {
      const result = await apiFetch('/background-jobs/lead_miner/run', {
        method: 'POST',
        timeout: 300000,
      });
      setMineResult(`Found ${result.itemsProcessed || 0} new leads`);
      load();
    } catch (err) {
      setMineResult('Mining failed: ' + err.message);
    } finally {
      setMining(false);
    }
  }

  async function updateStage(contactId, stage) {
    await apiFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify({ pipeline_stage: stage }),
    });
    load();
  }

  const filtered = stageFilter ? contacts.filter(c => c.pipeline_stage === stageFilter) : contacts;

  // Pipeline summary
  const stageCounts = {};
  PIPELINE_STAGES.forEach(s => { stageCounts[s] = contacts.filter(c => c.pipeline_stage === s).length; });

  const columns = [
    { key: 'first_name', label: 'Name', render: row => <span style={{ fontWeight: 500 }}>{row.first_name} {row.last_name}</span> },
    { key: 'organisation_name', label: 'Organisation', render: row => row.organisation_name || '—' },
    { key: 'sector_name', label: 'Sector', render: row => <SectorBadge name={row.sector_name} colour={row.sector_colour} /> },
    { key: 'pipeline_stage', label: 'Stage', render: row => (
      <select value={row.pipeline_stage} onChange={e => { e.stopPropagation(); updateStage(row.id, e.target.value); }}
        style={{ fontSize: 12, padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: 4, background: STAGE_COLORS[row.pipeline_stage] + '22', color: STAGE_COLORS[row.pipeline_stage] }}>
        {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
      </select>
    )},
    { key: 'source', label: 'Source', render: row => (
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.source === 'email_mining' ? '📧 Email' : row.source || '—'}</span>
    )},
    { key: 'tags', label: 'Warmth', render: row => {
      const tags = row.tags || [];
      const warmth = tags.find(t => ['hot', 'warm', 'cold'].includes(t));
      if (!warmth) return '—';
      const colors = { hot: '#EF4444', warm: '#F59E0B', cold: '#94A3B8' };
      return <span style={{ fontSize: 11, fontWeight: 600, color: colors[warmth] }}>{warmth.toUpperCase()}</span>;
    }},
    { key: 'last_contacted_at', label: 'Last Contact', render: row => row.last_contacted_at ? new Date(row.last_contacted_at).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <PageHeader title="Leads">
        <button className="btn btn-primary" onClick={runLeadMiner} disabled={mining}>
          {mining ? 'Mining...' : '🔍 Mine Gmail for Leads'}
        </button>
      </PageHeader>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Manage your sales pipeline. Use the Lead Finder AI to discover new prospects from your email, or add leads manually.
      </p>

      {mineResult && (
        <div style={{ marginBottom: 16, padding: 10, background: '#F1F5F9', borderRadius: 6, fontSize: 13 }}>{mineResult}</div>
      )}

      {/* Pipeline summary bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}>
        {PIPELINE_STAGES.map(stage => (
          <button key={stage} onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
            style={{
              flex: stageCounts[stage] || 0.3, padding: '10px 12px', border: 'none', cursor: 'pointer',
              background: stageFilter === stage ? STAGE_COLORS[stage] : STAGE_COLORS[stage] + '33',
              color: stageFilter === stage ? 'white' : STAGE_COLORS[stage],
              fontWeight: 600, fontSize: 12, transition: 'all 0.15s',
            }}>
            {stage.charAt(0).toUpperCase() + stage.slice(1)} ({stageCounts[stage]})
          </button>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>
          Pipeline ({filtered.length})
        </button>
        <button className={`tab ${activeTab === 'finder' ? 'active' : ''}`} onClick={() => setActiveTab('finder')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Lead Finder <AiBadge />
        </button>
      </div>

      {activeTab === 'pipeline' && (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={row => navigate(`/contacts/${row.id}`)}
          emptyMessage="No leads yet. Click 'Mine Gmail for Leads' to discover prospects from your email."
        />
      )}

      {activeTab === 'finder' && (
        <AgentChatPanel
          agentType="lead_finder"
          placeholder="Ask about target organisations, draft outreach emails, build campaign strategies..."
          emptyText="Lead Finder — find and engage new clients for Develop AI's training programmes"
        />
      )}
    </div>
  );
}
