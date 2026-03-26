import { google } from 'googleapis';
import config from '../config.js';
import pool from '../db/pool.js';

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

export function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
}

export async function handleCallback(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user email
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email;

  // Store tokens
  await pool.query(
    `INSERT INTO gmail_tokens (user_email, access_token, refresh_token, token_expiry)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_email) DO UPDATE SET
       access_token = $2, refresh_token = COALESCE($3, gmail_tokens.refresh_token),
       token_expiry = $4, updated_at = NOW()`,
    [email, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
  );

  return email;
}

async function getAuthedClient() {
  const { rows } = await pool.query('SELECT * FROM gmail_tokens ORDER BY updated_at DESC LIMIT 1');
  if (rows.length === 0) throw new Error('Gmail not connected. Go to Settings to connect.');

  const token = rows[0];
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.token_expiry ? new Date(token.token_expiry).getTime() : null,
  });

  // Auto-refresh if expired
  oauth2Client.on('tokens', async (newTokens) => {
    await pool.query(
      `UPDATE gmail_tokens SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3`,
      [newTokens.access_token, newTokens.expiry_date ? new Date(newTokens.expiry_date) : null, token.id]
    );
  });

  return { oauth2Client, email: token.user_email };
}

export async function sendEmail(to, subject, body) {
  const { oauth2Client, email } = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const raw = Buffer.from(
    `From: ${email}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return result.data;
}

export async function searchEmails(query, maxResults = 20) {
  const { oauth2Client } = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
  return res.data.messages || [];
}

export async function readEmail(messageId) {
  const { oauth2Client } = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const msg = res.data;

  // Extract headers
  const headers = msg.payload.headers || [];
  const getHeader = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  const from = getHeader('From');
  const subject = getHeader('Subject');
  const date = getHeader('Date');

  // Extract body text
  let body = '';
  function extractText(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
      // Fallback to HTML, strip tags
      const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (part.parts) part.parts.forEach(extractText);
  }

  if (msg.payload.body?.data) {
    body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
  }
  if (msg.payload.parts) msg.payload.parts.forEach(extractText);

  return { id: msg.id, from, subject, date, body: body.slice(0, 20000) };
}

export async function getLabelId(labelName) {
  const { oauth2Client } = await getAuthedClient();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.labels.list({ userId: 'me' });
  const label = res.data.labels?.find(l => l.name.toLowerCase() === labelName.toLowerCase());
  return label?.id || null;
}

export async function getConnectionStatus() {
  const { rows } = await pool.query('SELECT user_email, updated_at FROM gmail_tokens ORDER BY updated_at DESC LIMIT 1');
  if (rows.length === 0) return { connected: false };
  return { connected: true, email: rows[0].user_email, connectedAt: rows[0].updated_at };
}

export async function disconnect() {
  await pool.query('DELETE FROM gmail_tokens');
  return { ok: true };
}
