import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiFetch } from '../../hooks/useApi.js';
import SectorBadge from '../../components/SectorBadge.jsx';
import ContactForm from './ContactForm.jsx';
import Modal from '../../components/Modal.jsx';

const STAGE_LABELS = {
  prospect: 'Prospect', contacted: 'Contacted', meeting: 'Meeting',
  proposal: 'Proposal', client: 'Client', inactive: 'Inactive',
};

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contact, setContact] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    apiFetch(`/contacts/${id}`).then(setContact).catch(() => navigate('/contacts'));
  }

  useEffect(load, [id]);

  async function handleDelete() {
    await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
    navigate('/contacts');
  }

  if (!contact) return null;

  return (
    <div>
      <Link to="/contacts" className="back-link">← Contacts</Link>
      <div className="detail-header">
        <h1>{contact.first_name} {contact.last_name}</h1>
        <SectorBadge name={contact.sector_name} colour={contact.sector_colour} />
        <span className={`stage-badge stage-${contact.pipeline_stage}`}>
          {STAGE_LABELS[contact.pipeline_stage] || contact.pipeline_stage}
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
            <div className="detail-field-label">Email</div>
            <div className="detail-field-value">{contact.email || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Phone</div>
            <div className="detail-field-value">{contact.phone || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Job Title</div>
            <div className="detail-field-value">{contact.job_title || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Organisation</div>
            <div className="detail-field-value">
              {contact.organisation_id ? (
                <Link to={`/organisations/${contact.organisation_id}`}>{contact.organisation_name}</Link>
              ) : '—'}
            </div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Source</div>
            <div className="detail-field-value">{contact.source || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Last Contacted</div>
            <div className="detail-field-value">
              {contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : '—'}
            </div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">LinkedIn</div>
            <div className="detail-field-value">
              {contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noreferrer">{contact.linkedin_url}</a> : '—'}
            </div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Tags</div>
            <div className="detail-field-value">
              {contact.tags?.length > 0 ? contact.tags.join(', ') : '—'}
            </div>
          </div>
        </div>
        {contact.notes && (
          <div style={{ marginTop: '16px' }}>
            <div className="detail-field-label">Notes</div>
            <div className="detail-field-value" style={{ whiteSpace: 'pre-wrap' }}>{contact.notes}</div>
          </div>
        )}
      </div>

      {editing && (
        <ContactForm
          contact={contact}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {deleting && (
        <Modal title="Delete Contact" onClose={() => setDeleting(false)}>
          <p>Are you sure you want to delete {contact.first_name} {contact.last_name}? This cannot be undone.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setDeleting(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
