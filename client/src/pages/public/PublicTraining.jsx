// Training — videos & AI training materials, pulled from published courses and
// their modules (a module appears if its course isn't a draft and it has a
// video or material link). Grouped by course.
import { useEffect, useState } from 'react';

export default function PublicTraining() {
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    fetch('/api/public/training')
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .catch(() => setCourses([]));
  }, []);

  return (
    <div>
      <section style={{ marginBottom: 24, maxWidth: 760 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
          Training
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          AI training for newsrooms
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Videos and materials from our recent courses, plus other AI training resources.
        </p>
      </section>

      {courses === null && <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
      {courses && courses.length === 0 && (
        <div className="card" style={{ padding: 24, color: 'var(--text-secondary)' }}>
          No training published yet. Publish a course (and add video/material links to its modules) and it'll appear here.
        </div>
      )}

      {courses && courses.map(c => (
        <section key={c.id} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>{c.title}</h2>
          {c.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 14px 0', maxWidth: 720 }}>{c.description}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {c.modules.map(m => (
              <div key={m.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px 0' }}>{m.title}</h3>
                {m.duration_minutes ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{m.duration_minutes} min</div> : null}
                {m.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 12px 0', flex: 1 }}>{m.description}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
                  {m.video_url && (
                    <a href={m.video_url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>▶ Watch video</a>
                  )}
                  {m.content_url && (
                    <a href={m.content_url} target="_blank" rel="noreferrer" className="btn" style={{ fontSize: 13, textDecoration: 'none' }}>Materials</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
