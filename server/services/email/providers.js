// Email provider abstraction. Call `getMailer()` to get a sender, then
// `await mailer.send({ to, subject, html, text, headers })`.
//
// Picked by EMAIL_PROVIDER env:
//   console   — logs the email to stdout (default when no real provider
//               credentials are set). Use for dev / staging.
//   postmark  — uses POSTMARK_TOKEN + POSTMARK_FROM
//   resend    — uses RESEND_API_KEY + RESEND_FROM
//   ses       — uses AWS_REGION + standard AWS SDK creds + SES_FROM
//
// The real-provider paths are intentionally minimal — each one requires
// installing the provider SDK before use. We stub them so you can flip
// EMAIL_PROVIDER later without changing caller code.

const PROVIDER = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();

function truthy(s) { return s && s.length > 0; }

// ── Console (dev default) ────────────────────────────────────────────────────
function consoleMailer() {
  return {
    name: 'console',
    async send({ to, subject, html, text, headers }) {
      const divider = '─'.repeat(72);
      console.log(`\n${divider}\n[email:console] to=${to}\nsubject=${subject}`);
      if (headers) console.log('headers=', headers);
      console.log(`${divider}\n${text || html || '(no body)'}\n${divider}\n`);
      return { ok: true, messageId: `console-${Date.now()}` };
    },
  };
}

// ── Postmark ─────────────────────────────────────────────────────────────────
function postmarkMailer() {
  const token = process.env.POSTMARK_TOKEN;
  const from  = process.env.POSTMARK_FROM;
  if (!truthy(token) || !truthy(from)) {
    throw new Error('Postmark requires POSTMARK_TOKEN and POSTMARK_FROM env vars.');
  }
  return {
    name: 'postmark',
    async send({ to, subject, html, text, headers }) {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify({
          From: from,
          To: to,
          Subject: subject,
          HtmlBody: html,
          TextBody: text,
          MessageStream: 'outbound',
          Headers: headers ? Object.entries(headers).map(([Name, Value]) => ({ Name, Value })) : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: `postmark ${res.status}: ${body.Message || 'unknown'}` };
      return { ok: true, messageId: body.MessageID };
    },
  };
}

// ── Resend ───────────────────────────────────────────────────────────────────
function resendMailer() {
  const key  = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!truthy(key) || !truthy(from)) {
    throw new Error('Resend requires RESEND_API_KEY and RESEND_FROM env vars.');
  }
  return {
    name: 'resend',
    async send({ to, subject, html, text, headers }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html, text, headers }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: `resend ${res.status}: ${body.message || 'unknown'}` };
      return { ok: true, messageId: body.id };
    },
  };
}

// ── SES (AWS SDK v3 — deferred require so it's only needed if selected) ──────
async function sesMailer() {
  const from = process.env.SES_FROM;
  if (!truthy(from)) throw new Error('SES requires SES_FROM env var.');
  let SESv2;
  try {
    SESv2 = await import('@aws-sdk/client-sesv2');
  } catch {
    throw new Error('SES provider requires `npm install @aws-sdk/client-sesv2` in server/.');
  }
  const client = new SESv2.SESv2Client({});
  return {
    name: 'ses',
    async send({ to, subject, html, text }) {
      const cmd = new SESv2.SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: {
              Html: html ? { Data: html } : undefined,
              Text: text ? { Data: text } : undefined,
            },
          },
        },
      });
      try {
        const res = await client.send(cmd);
        return { ok: true, messageId: res.MessageId };
      } catch (err) {
        return { ok: false, error: `ses: ${err.message}` };
      }
    },
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────
export async function getMailer() {
  switch (PROVIDER) {
    case 'postmark': return postmarkMailer();
    case 'resend':   return resendMailer();
    case 'ses':      return sesMailer();
    case 'console':
    default:         return consoleMailer();
  }
}
