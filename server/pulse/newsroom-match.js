// Fuzzy-match a free-text newsroom string (e.g. Node Install.newsroom, which is
// NOT a link and often won't match exactly) against the Newsrooms table. Returns
// ranked candidates so the admin UI can show a best guess for Paul to confirm or
// correct (decision: fuzzy match + manual override).

function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fm|radio|news|media|the|community|online|ltd|limited)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return new Set(normalise(s).split(' ').filter(Boolean));
}

// Jaccard-ish token overlap plus a substring bonus, in [0,1].
function score(a, b) {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = new Set([...ta, ...tb]).size;
  let s = inter / union;
  if (na.includes(nb) || nb.includes(na)) s = Math.max(s, 0.6);
  return s;
}

// newsrooms: array of Airtable records ({id, fields:{Name}}). Returns top
// candidates [{ id, name, score }] sorted desc; empty if query is blank.
export function matchNewsroom(query, newsrooms, { limit = 5 } = {}) {
  if (!query) return [];
  return newsrooms
    .map((r) => ({ id: r.id, name: r.fields?.Name || '', score: score(query, r.fields?.Name) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
