import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi.js';
import DataTable from '../../components/DataTable.jsx';
import FunderForm from './FunderForm.jsx';

const TYPE_LABELS = { foundation: 'Foundation', government: 'Government', arts_council: 'Arts Council', innovation_fund: 'Innovation Fund', international_development: 'International Dev' };

export default function FunderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funder, setFunder] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [editing, setEditing] = useState(false);

  function load() {
    apiFetch(`/funders/${id}`).then(setFunder).catch(() => navigate('/fundraising/funders'));
    apiFetch('/funding-opportunities').then(all => setOpportunities(all.filter(o => o.funder_id === id))).catch(() => setOpportunities([]));
  }
  useEffect(load, [id]);

  if (!funder) return null;

  const oppColumns = [
    { key: 'title', label: 'Opportunity', render: row => <span style={{ fontWeight: 500 }}>{row.title}</span> },
    { key: 'pipeline_stage', label: 'Stage', render: row => <span className={`stage-badge pipe-${row.pipeline_stage}`}>{row.pipeline_stage}</span> },
    { key: 'amount_max', label: 'Amount', render: row => row.amount_max ? `£${Number(row.amount_max).toLocaleString()}` : '—' },
    { key: 'deadline', label: 'Deadline', render: row => row.deadline ? new Date(row.deadline).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <Link to="/fundraising/funders" className="back-link">← Funders</Link>
      <div className="detail-header">
        <h1>{funder.name}</h1>
        <span className={`stage-badge funder-${funder.type}`}>{TYPE_LABELS[funder.type] || funder.type}</span>
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-secondary btn-small" onClick={() => setEditing(true)}>Edit</button>
        </div>
        <div className="detail-grid">
          <div className="detail-field"><div className="detail-field-label">Country</div><div className="detail-field-value">{funder.country || '—'}</div></div>
          <div className="detail-field"><div className="detail-field-label">Website</div><div className="detail-field-value">{funder.website ? <a href={funder.website} target="_blank" rel="noopener">{funder.website}</a> : '—'}</div></div>
          <div className="detail-field"><div className="detail-field-label">Contact</div><div className="detail-field-value">{funder.contact_name || '—'}{funder.contact_email ? ` (${funder.contact_email})` : ''}</div></div>
        </div>
        {funder.notes && <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{funder.notes}</div>}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Opportunities</h3>
      <DataTable columns={oppColumns} data={opportunities} onRowClick={row => navigate(`/fundraising/opportunities/${row.id}`)} emptyMessage="No opportunities from this funder yet." />

      {editing && <FunderForm funder={funder} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}
