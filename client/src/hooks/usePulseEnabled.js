import { useState, useEffect } from 'react';
import { apiFetch } from './useApi.js';

// Module-level cache so the flag is fetched once per session, not per component.
let cached = null;          // boolean once resolved
let inflight = null;        // promise while resolving

function fetchStatus() {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = apiFetch('/pulse/status')
      .then((d) => { cached = !!d.enabled; return cached; })
      .catch(() => { cached = false; return false; });
  }
  return inflight;
}

// Returns the Pulse feature flag: null while loading, then true/false.
export function usePulseEnabled() {
  const [enabled, setEnabled] = useState(cached);
  useEffect(() => {
    let live = true;
    fetchStatus().then((v) => { if (live) setEnabled(v); });
    return () => { live = false; };
  }, []);
  return enabled;
}
