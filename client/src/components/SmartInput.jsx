import { useState, useRef } from 'react';
import { apiFetch } from '../hooks/useApi.js';
import AiBadge from './AiBadge.jsx';

/**
 * SmartInput — universal AI-powered input for any detail page.
 * Drop a document or type a line. AI extracts relevant info and updates the entity.
 *
 * Props:
 *   entityType: 'organisation' | 'contact' | 'cohort' | 'course' | 'engagement' | 'funder' etc.
 *   entityId: UUID of the entity
 *   sectorId: optional sector UUID
 *   onUpdated: callback after data is absorbed
 *   compact: boolean — smaller version for tight layouts
 */
export default function SmartInput({ entityType, entityId, sectorId, onUpdated, compact = false }) {
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  async function handleTextSubmit(e) {
    e?.preventDefault();
    if (!text.trim() || processing) return;
    setProcessing(true);
    setResult('');
    try {
      const res = await apiFetch('/uploads/smart-input', {
        method: 'POST',
        body: JSON.stringify({ text, entityType, entityId, sectorId }),
        timeout: 60000,
      });
      setResult(res.message || 'Information absorbed.');
      setText('');
      setTimeout(() => setResult(''), 4000);
      onUpdated?.();
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleFile(file) {
    if (!file || processing) return;
    setProcessing(true);
    setResult('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      if (sectorId) formData.append('sector_id', sectorId);

      const res = await fetch('/api/uploads/smart-input-file', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setResult(data.message || 'Document absorbed.');
      setTimeout(() => setResult(''), 4000);
      onUpdated?.();
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }

  const pad = compact ? 10 : 14;

  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
      padding: pad, marginTop: compact ? 8 : 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <AiBadge />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {processing ? 'Processing...' : 'Add information'}
        </span>
      </div>

      {/* Text input */}
      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a note, update, or piece of info about this item..."
          disabled={processing}
          style={{
            flex: 1, fontSize: 13, padding: '8px 12px',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleTextSubmit(e); }}
        />
        <button type="submit" className="btn btn-primary btn-small" disabled={processing || !text.trim()}>
          {processing ? '...' : 'Add'}
        </button>
      </form>

      {/* File drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `1px dashed ${dragOver ? 'var(--ai-purple)' : 'var(--border-color)'}`,
          borderRadius: 'var(--radius)', padding: compact ? '6px 10px' : '8px 12px',
          textAlign: 'center', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
          background: dragOver ? '#F5F3FF' : 'transparent',
        }}
      >
        {processing ? 'Extracting with AI...' : 'Drop a document here or click to upload (PDF, DOCX, TXT)'}
        <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.doc,.txt,.csv,.xlsx" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </div>

      {/* Result message */}
      {result && (
        <div style={{ marginTop: 6, fontSize: 12, color: result.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
          {result}
        </div>
      )}
    </div>
  );
}
