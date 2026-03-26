import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectors } from '../../context/SectorContext.jsx';
import { apiFetch, buildUrl } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import DataTable from '../../components/DataTable.jsx';
import SectorBadge from '../../components/SectorBadge.jsx';
import Modal from '../../components/Modal.jsx';

const TYPE_LABELS = { ethical_ai_policy: 'Ethical AI Policy', ai_legal_framework: 'AI Legal Framework', ai_security_framework: 'AI Security Framework' };
const STATUS_LABELS = { draft: 'Draft', review: 'Review', final: 'Final' };
const TYPES = ['ethical_ai_policy', 'ai_legal_framework', 'ai_security_framework'];

export default function DocumentsList() {
  const navigate = useNavigate();
  const { sectors, selectedSectorId } = useSectors();
  const [docs, setDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('documents');
  const [editingTemplate, setEditingTemplate] = useState(null);

  function loadDocs() {
    apiFetch(buildUrl('/generated-documents', selectedSectorId)).then(setDocs).catch(() => setDocs([]));
  }
  function loadTemplates() {
    apiFetch('/document-templates/all').then(setTemplates).catch(() => setTemplates([]));
  }

  useEffect(loadDocs, [selectedSectorId]);
  useEffect(loadTemplates, []);

  const columns = [
    { key: 'title', label: 'Title', render: row => <span style={{ fontWeight: 500 }}>{row.title}</span> },
    { key: 'template_type', label: 'Type', render: row => (
      <span className="stage-badge stage-active">{TYPE_LABELS[row.template_type] || row.template_type}</span>
    )},
    { key: 'organisation_name', label: 'Organisation', render: row => row.organisation_name || '—' },
    { key: 'sector_name', label: 'Sector', render: row => <SectorBadge name={row.sector_name} colour={row.sector_colour} /> },
    { key: 'status', label: 'Status', render: row => (
      <span className={`stage-badge status-${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span>
    )},
    { key: 'created_at', label: 'Created', render: row => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title="Documents">
        {activeTab === 'documents' && (
          <button className="btn btn-primary" onClick={() => navigate('/documents/new')}>+ Generate Document</button>
        )}
        {activeTab === 'templates' && (
          <button className="btn btn-primary" onClick={() => setEditingTemplate('new')}>+ Add Template</button>
        )}
      </PageHeader>

      <div className="tabs">
        <button className={`tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
          Documents ({docs.length})
        </button>
        <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          Templates ({templates.length})
        </button>
      </div>

      {activeTab === 'documents' && (
        <DataTable
          columns={columns}
          data={docs}
          onRowClick={row => navigate(`/documents/${row.id}`)}
          emptyMessage="No documents yet. Generate your first AI policy or legal framework."
        />
      )}

      {activeTab === 'templates' && (
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Sector</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.5 }}>
                <td style={{ fontWeight: 500 }}>{t.title}</td>
                <td><span className="stage-badge stage-active">{TYPE_LABELS[t.type] || t.type}</span></td>
                <td>{t.sector_name}</td>
                <td>{t.is_active ? 'Yes' : 'No'}</td>
                <td><button className="btn btn-secondary btn-small" onClick={() => setEditingTemplate(t)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingTemplate && (
        <TemplateForm
          template={editingTemplate === 'new' ? null : editingTemplate}
          sectors={sectors}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => { setEditingTemplate(null); loadTemplates(); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, sectors, onClose, onSaved }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sector_id: template?.sector_id || '',
    type: template?.type || 'ethical_ai_policy',
    title: template?.title || '',
    description: template?.description || '',
    template_prompt: template?.template_prompt || '',
    structure: template?.structure ? JSON.stringify(template.structure, null, 2) : '[]',
    is_active: template?.is_active !== false,
  });

  function set(field) {
    return e => {
      const val = field === 'is_active' ? e.target.checked : e.target.value;
      setForm(prev => ({ ...prev, [field]: val }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let structure;
      try { structure = JSON.parse(form.structure); } catch { structure = []; }
      const body = { ...form, structure };
      if (template) {
        await apiFetch(`/document-templates/${template.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/document-templates', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={template ? 'Edit Template' : 'Add Template'} onClose={onClose}>
      {error && <div className="login-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title *</label>
          <input value={form.title} onChange={set('title')} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Sector *</label>
            <select value={form.sector_id} onChange={set('sector_id')} required>
              <option value="">Select...</option>
              {sectors.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Type *</label>
            <select value={form.type} onChange={set('type')}>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} rows={2} />
        </div>
        <div className="form-group">
          <label>Generation Prompt (system prompt for Claude) *</label>
          <textarea value={form.template_prompt} onChange={set('template_prompt')} rows={6} required style={{ fontFamily: 'monospace', fontSize: 13 }} />
        </div>
        <div className="form-group">
          <label>Structure (JSON array of section headings)</label>
          <textarea value={form.structure} onChange={set('structure')} rows={4} style={{ fontFamily: 'monospace', fontSize: 13 }} />
        </div>
        {template && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={set('is_active')} id="t_active" />
            <label htmlFor="t_active" style={{ marginBottom: 0 }}>Active</label>
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : (template ? 'Update' : 'Create')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
