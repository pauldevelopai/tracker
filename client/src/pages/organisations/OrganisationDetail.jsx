import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiFetch } from '../../hooks/useApi.js';
import SectorBadge from '../../components/SectorBadge.jsx';
import DataTable from '../../components/DataTable.jsx';
import OrganisationForm from './OrganisationForm.jsx';
import Modal from '../../components/Modal.jsx';
import DocumentUpload from '../../components/DocumentUpload.jsx';
import SmartInput from '../../components/SmartInput.jsx';

const STAGE_LABELS = {
  prospect: 'Prospect', active: 'Active', partner: 'Partner', inactive: 'Inactive',
};

export default function OrganisationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [programmeOrgs, setProgrammeOrgs] = useState([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    apiFetch(`/organisations/${id}`).then(o => {
      setOrg(o);
      // If this is a funder, load programme orgs linked to it
      if (o.relationship_type === 'funder') {
        apiFetch(`/organisations?funder_id=${id}`).then(setProgrammeOrgs).catch(() => setProgrammeOrgs([]));
      }
    }).catch(() => navigate('/organisations'));
    apiFetch(`/contacts?organisation_id=${id}`).then(setContacts).catch(() => setContacts([]));
  }

  useEffect(load, [id]);

  async function handleDelete() {
    await apiFetch(`/organisations/${id}`, { method: 'DELETE' });
    navigate('/organisations');
  }

  if (!org) return null;

  const contactColumns = [
    { key: 'name', label: 'Name', render: row => (
      <Link to={`/contacts/${row.id}`}>{row.first_name} {row.last_name}</Link>
    )},
    { key: 'email', label: 'Email' },
    { key: 'job_title', label: 'Job Title', render: row => row.job_title || '—' },
    { key: 'pipeline_stage', label: 'Stage', render: row => (
      <span className={`stage-badge stage-${row.pipeline_stage}`}>{row.pipeline_stage}</span>
    )},
  ];

  return (
    <div>
      <Link to="/organisations" className="back-link">← Organisations</Link>
      <div className="detail-header">
        <h1>{org.name}</h1>
        <SectorBadge name={org.sector_name} colour={org.sector_colour} />
        <span className={`stage-badge stage-${org.relationship_stage}`}>
          {STAGE_LABELS[org.relationship_stage] || org.relationship_stage}
        </span>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
          <button className="btn btn-secondary btn-small" onClick={() => setEditing(true)}>Edit</button>
          {user?.role === 'admin' && (
            <button className="btn btn-danger btn-small" onClick={() => setDeleting(true)}>Delete</button>
          )}
        </div>
        <div className="detail-grid">
          <div className="detail-field">
            <div className="detail-field-label">Type</div>
            <div className="detail-field-value">{org.type || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Relationship</div>
            <div className="detail-field-value">
              <span className={`stage-badge ${org.relationship_type === 'funder' ? 'stage-active' : org.relationship_type === 'programme_org' ? 'stage-client' : 'stage-prospect'}`}>
                {(org.relationship_type || 'lead').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          {org.programme_name && (
            <div className="detail-field">
              <div className="detail-field-label">Programme</div>
              <div className="detail-field-value">{org.programme_name}</div>
            </div>
          )}
          <div className="detail-field">
            <div className="detail-field-label">Location</div>
            <div className="detail-field-value">{[org.city, org.country].filter(Boolean).join(', ') || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Website</div>
            <div className="detail-field-value">
              {org.website ? <a href={org.website} target="_blank" rel="noreferrer">{org.website}</a> : '—'}
            </div>
          </div>
        </div>
        {org.notes && (
          <div style={{ marginTop: '16px' }}>
            <div className="detail-field-label">Notes</div>
            <div className="detail-field-value" style={{ whiteSpace: 'pre-wrap' }}>{org.notes}</div>
          </div>
        )}
      </div>

      {/* Programme Organisations (for funders) */}
      {org.relationship_type === 'funder' && (
        <div className="detail-section">
          <h2>Programme Organisations ({programmeOrgs.length})</h2>
          {programmeOrgs.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr><th>Organisation</th><th>Programme</th><th>Country</th><th>Status</th></tr>
              </thead>
              <tbody>
                {programmeOrgs.map(po => (
                  <tr key={po.id} onClick={() => navigate(`/organisations/${po.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{po.name}</td>
                    <td>{po.programme_name || '—'}</td>
                    <td>{po.country || '—'}</td>
                    <td><span className={`stage-badge stage-${po.relationship_stage}`}>{po.relationship_stage}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 14 }}>No programme organisations linked yet.</div>
          )}
        </div>
      )}

      {/* Funder link (for programme orgs) */}
      {org.relationship_type === 'programme_org' && org.funder_organisation_id && (
        <div className="detail-section">
          <h2>Funder</h2>
          <Link to={`/organisations/${org.funder_organisation_id}`} style={{ fontSize: 14, fontWeight: 500 }}>
            View funder organisation →
          </Link>
        </div>
      )}

      <div className="detail-section">
        <h2>Documents</h2>
        <DocumentUpload entityType="organisation" entityId={id} sectorId={org.sector_id} onUploaded={load} />
      </div>

      <div className="detail-section">
        <h2>Contacts ({contacts.length})</h2>
        <DataTable columns={contactColumns} data={contacts} emptyMessage="No contacts linked to this organisation." />
      </div>

      {editing && (
        <OrganisationForm
          organisation={org}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {deleting && (
        <Modal title="Delete Organisation" onClose={() => setDeleting(false)}>
          <p>Are you sure you want to delete {org.name}? This cannot be undone.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setDeleting(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </Modal>
      )}

      <SmartInput entityType="organisation" entityId={id} sectorId={org.sector_id} onUpdated={() => load()} />
    </div>
  );
}
