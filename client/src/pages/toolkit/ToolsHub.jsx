// Operations tools index — the 4 newsroom-utility tools, each opening a workspace.
// (They're also droppable into workflows in the Builder.)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../hooks/useApi.js';

export default function ToolsHub() {
  const [tools, setTools] = useState([]);
  useEffect(() => { apiFetch('/tool-kit').then((r) => setTools(r.tools || [])).catch(() => setTools([])); }, []);

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Builder · Operations tools</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Operations tools</h1>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 720, margin: '0 0 24px' }}>
        Claude-powered tools for running the newsroom. Use one directly here, or drop it into a workflow in the Builder.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {tools.map((t) => (
          <Link key={t.slug} to={`/tool/${t.slug}`} className="card" style={{ padding: 20, textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{t.icon}</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{t.name}{t.comingSoon ? ' (soon)' : ''}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{t.description}</p>
          </Link>
        ))}
        {tools.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
      </div>
    </div>
  );
}
