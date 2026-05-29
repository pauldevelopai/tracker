import { usePulseEnabled } from '../../hooks/usePulseEnabled.js';

// Wraps the Pulse admin routes. When the feature flag is off, the routes behave
// as if they don't exist (matches the server-side 404). While the flag resolves
// we render nothing to avoid a flash.
export default function PulseGate({ children }) {
  const enabled = usePulseEnabled();
  if (enabled === null) return null;
  if (!enabled) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <h3>Not found</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Pulse is not enabled.</p>
      </div>
    );
  }
  return children;
}
