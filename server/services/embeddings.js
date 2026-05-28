// RAG embeddings — OpenAI text-embedding-3-small (1536-dim).
//
// Replaced the local 2021 all-MiniLM-L6-v2 (384-dim, transformers.js) with a
// modern hosted embedding model: far stronger retrieval relevance, fast, and
// very cheap (~$0.02 / 1M tokens — pennies a month at this scale). Same exported
// interface as before, so callers (knowledge.js, background-jobs.js) are unchanged.
//
// Needs OPENAI_API_KEY on the box. If absent or the call fails, generateEmbedding
// returns null and retrieval degrades gracefully to keyword-only (the SQL
// COALESCEs a missing vector score to 0).
import config from '../config.js';

const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'; // 1536 dims
const API_URL = 'https://api.openai.com/v1/embeddings';
const MAX_CHARS = 8000; // text-embedding-3 handles ~8k tokens; chars are a safe under-bound

let warnedNoKey = false;

export async function generateEmbedding(text) {
  const key = config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    if (!warnedNoKey) { console.error('[Embeddings] OPENAI_API_KEY not set — RAG will run keyword-only.'); warnedNoKey = true; }
    return null;
  }
  const input = (text || '').slice(0, MAX_CHARS).trim();
  if (!input) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, input }),
    });
    if (!res.ok) {
      console.error('[Embeddings] API error', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('[Embeddings] Error generating embedding:', err.message);
    return null;
  }
}

/** Format embedding array as a pgvector literal: '[0.1,0.2,...]' */
export function toPgVector(embedding) {
  if (!embedding) return null;
  return `[${embedding.join(',')}]`;
}

/** Is the embedding backend usable? (key present) */
export async function isAvailable() {
  return !!(config.openaiApiKey || process.env.OPENAI_API_KEY);
}
