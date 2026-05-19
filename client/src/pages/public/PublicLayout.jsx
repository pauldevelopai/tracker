import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// Lazy so the chatbot bundle doesn't block first paint — it's only used
// once a visitor clicks the 💬 button.
const PublicChatbot = lazy(() => import('./PublicChatbot.jsx'));

const navStyle = ({ isActive }) => ({
  padding: '8px 12px',
  borderRadius: 'var(--radius)',
  fontSize: 14,
  fontWeight: isActive ? 600 : 500,
  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
  background: isActive ? '#EEF2FF' : 'transparent',
  textDecoration: 'none',
});

const inactiveStyle = navStyle({ isActive: false });

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  useEffect(() => {
    const prev = document.title;
    document.title = 'Grounded: AI Legal — Global AI Lawsuits & Regulations Tracker';
    return () => { document.title = prev; };
  }, []);

  // Where to bring the user back to after a successful sign-in.
  const nextParam = encodeURIComponent(location.pathname + location.search);
  const firstName = user?.name?.split(' ')[0] || user?.email || 'admin';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--content-bg)', color: 'var(--text-primary)',
    }}>
      <header style={{
        borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Grounded: AI&nbsp;Legal</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Global AI lawsuits &amp; regulations tracker
              </span>
            </div>
          </Link>
          <nav style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <NavLink to="/" end style={navStyle}>Home</NavLink>
            <NavLink to="/legal/lawsuits" style={navStyle}>Lawsuits</NavLink>
            <NavLink to="/legal/regulations" style={navStyle}>Regulations</NavLink>
            <NavLink to="/legal/explore" style={navStyle}>Connections</NavLink>
            <NavLink to="/legal/use-cases" style={navStyle}>Use cases</NavLink>
            <a href="/aikit/" style={inactiveStyle}>Tools</a>
            <NavLink to="/legal/sources" style={navStyle}>Sources</NavLink>
            <NavLink to="/legal/submit" style={navStyle}>Submit</NavLink>
            {user ? (
              <>
                <span style={{ ...inactiveStyle, color: 'var(--text-primary)', fontWeight: 600 }}>Hi, {firstName}</span>
                <button onClick={async () => { await logout(); window.location.reload(); }}
                        style={{ ...inactiveStyle, background: 'transparent', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  Sign out
                </button>
              </>
            ) : (
              <a href={`/login?next=${nextParam}`} style={{ ...inactiveStyle, border: '1px solid var(--border-color)' }}>
                Sign&nbsp;in&nbsp;/&nbsp;Register
              </a>
            )}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <Outlet />
      </main>

      <Suspense fallback={null}><PublicChatbot /></Suspense>

      <footer style={{
        borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)',
        padding: '20px 24px', marginTop: 48,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span>© Grounded · <a href="https://grounded.developai.co.za" style={{ color: 'var(--text-secondary)' }}>grounded.developai.co.za</a></span>
          <span>Tracking global AI lawsuits and regulations</span>
        </div>
      </footer>
    </div>
  );
}
