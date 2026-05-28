import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';

// The single "submit anything about Grounded" mechanism. The old public Submit
// page is folded in here: a signed-in user picks which part of Grounded they're
// commenting on, writes a message, and it lands in the admin Feedback page.
// Logged-out visitors get a sign-in prompt (feedback is signed-in only).

const CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'ui', label: 'UI/Design' },
];

// "Any part of Grounded." Stored in the feedback `page` field so admin sees it.
const AREAS = ['General', 'Nodes', 'Tools', 'Lawsuits', 'Regulations', 'Connections', 'Use cases', 'Sources'];

export default function FeedbackBubble() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [area, setArea] = useState('General');
  const [category, setCategory] = useState('feature');
  const [priority, setPriority] = useState('medium');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const location = useLocation();

  const nextParam = encodeURIComponent(location.pathname + location.search);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await apiFetch('/feedback', {
        method: 'POST',
        // Put the chosen area first so it's the headline in admin; keep the
        // real path for context. Admin's FeedbackList renders `page`.
        body: JSON.stringify({ content, category, priority, page: `${area} · ${location.pathname}` }),
      });
      setSent(true);
      setContent('');
      setTimeout(() => { setSent(false); setOpen(false); }, 1500);
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Round terracotta icon button — identical to the shared chrome.js bubble.
          Feedback sits in the corner (bottom:20); the chat bubble stacks above it. */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 20, right: 20, width: 52, height: 52,
          borderRadius: '50%', background: '#c4761b', color: 'white', border: 'none',
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#a8543a')}
        onMouseLeave={e => (e.currentTarget.style.background = '#c4761b')}
        title="Send feedback about any part of Grounded"
        aria-label="Send feedback"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 72, right: 20, width: 330,
          background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1003, padding: 20, border: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 15 }}>Send feedback</h4>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}>x</button>
          </div>

          {!user ? (
            // Logged-out: feedback is signed-in only.
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 14px' }}>
                Sign in to send feedback about any part of Grounded — it goes straight to the team.
              </p>
              <a href={`/login?next=${nextParam}`} className="btn btn-primary"
                 style={{ display: 'inline-block', fontSize: 13, textDecoration: 'none' }}>
                Sign in to send feedback
              </a>
            </div>
          ) : sent ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--success)' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>Submitted</div>
              <div style={{ fontSize: 13 }}>Thanks — we've logged it.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Which part of Grounded */}
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>About</label>
              <select value={area} onChange={e => setArea(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, marginBottom: 10 }}>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      background: category === c.value ? 'var(--accent)' : 'white',
                      color: category === c.value ? 'white' : 'var(--text-primary)',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={`What would you like to tell us about ${area}?`}
                rows={4}
                style={{ width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                required
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <select value={priority} onChange={e => setPriority(e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}>
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
                <button type="submit" disabled={sending} style={{
                  padding: '6px 16px', background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                }}>
                  {sending ? '...' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
