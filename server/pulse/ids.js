import { randomBytes } from 'node:crypto';

// Human-ish, sortable-enough id for the text primary fields (Airtable can't make
// autonumber primaries). e.g. CYC-LXY8Q2-4F9A
export function shortId(prefix) {
  const t = Date.now().toString(36).toUpperCase();
  const r = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${t}-${r}`;
}

// Long, unguessable token for the public answer URL.
export function publicToken() {
  return randomBytes(24).toString('base64url');
}
