export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 401) {
    // Don't redirect if we're already on login or doing the initial auth check
    if (!window.location.pathname.startsWith('/login') && !path.includes('/auth/me')) {
      window.location.href = '/login';
    }
    throw new Error('Not authenticated');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Request failed');
  }

  return res.json();
}

export function buildUrl(path, sectorId) {
  if (!sectorId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}sector_id=${sectorId}`;
}
