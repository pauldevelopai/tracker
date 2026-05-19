// Bridge tracker auth into AIKit (Tool Tracker FastAPI app).
//
// AIKit's real auth is opaque session tokens stored in its `sessions` table
// and read from a cookie called `session`. We:
//   1. Ensure the tracker user has a row in AIKit's `users` table (matched
//      by email). If absent, INSERT with a placeholder bcrypt hash —
//      AIKit's own login form is unreachable in this integration, so the
//      password column is never used.
//   2. INSERT a session row with a fresh token and a 30-day expiry.
//   3. Set the `session` cookie so any /aikit/* request proxied to AIKit
//      authenticates as that user.
//
// All AIKit DB access is via AIKIT_DATABASE_URL (separate pool from tracker).
// Failures are logged but never thrown — AIKit being down during dev must
// not block tracker login.

import { randomBytes, randomUUID } from 'node:crypto';
import pkg from 'pg';
const { Pool } = pkg;

const AIKIT_DB_URL = process.env.AIKIT_DATABASE_URL;

// 30 days — match AIKit's SESSION_MAX_AGE default.
const TTL_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_NAME = process.env.AIKIT_SESSION_COOKIE || 'session';

let _pool = null;
function aikitPool() {
  if (!AIKIT_DB_URL) {
    throw new Error('AIKIT_DATABASE_URL not configured');
  }
  if (!_pool) _pool = new Pool({ connectionString: AIKIT_DB_URL, max: 4 });
  return _pool;
}

export async function ensureAikitUser({ email, name, isAdmin }) {
  const pool = aikitPool();
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  if (existing.rows.length) return existing.rows[0].id;

  // hashed_password is NOT NULL but we never authenticate against it —
  // AIKit's own login form is unreachable in this integration. Placeholder
  // bcrypt-shaped string keeps the column happy without being valid.
  const placeholder = '$2b$12$0000000000000000000000.0000000000000000000000000000000000000';
  const userId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, username, hashed_password, is_active, is_admin, display_name)
     VALUES ($1, $2, $3, $4, true, $5, $6)`,
    [userId, email, email.split('@')[0], placeholder, !!isAdmin, name || null]
  );
  return userId;
}

export async function createAikitSession(userId) {
  const sessionId = randomUUID();
  const token = randomBytes(32).toString('hex');
  const pool = aikitPool();
  await pool.query(
    `INSERT INTO sessions (id, user_id, session_token, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::interval)`,
    [sessionId, userId, token, String(TTL_SECONDS)]
  );
  return token;
}

export async function deleteAikitSession(token) {
  if (!token) return;
  const pool = aikitPool();
  await pool.query('DELETE FROM sessions WHERE session_token = $1', [token]);
}

export function setAikitCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearAikitCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Mirror a tracker sign-in into AIKit. Failures here must not break tracker
// login — AIKit may be down — so we log and continue.
export async function bridgeAikitLogin(res, user) {
  try {
    const aikitId = await ensureAikitUser({
      email: user.email,
      name: user.name,
      isAdmin: user.role === 'admin',
    });
    const token = await createAikitSession(aikitId);
    setAikitCookie(res, token);
  } catch (err) {
    console.warn('[aikit-bridge] sign-in mirror failed:', err.message);
  }
}

export async function bridgeAikitLogout(req, res) {
  try {
    await deleteAikitSession(req.cookies?.[COOKIE_NAME]);
  } catch (err) {
    console.warn('[aikit-bridge] sign-out mirror failed:', err.message);
  } finally {
    clearAikitCookie(res);
  }
}
