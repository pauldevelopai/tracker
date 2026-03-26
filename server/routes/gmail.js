import { Router } from 'express';
import { getAuthUrl, handleCallback, getConnectionStatus, disconnect } from '../services/gmail.js';

const router = Router();

router.get('/status', async (req, res) => {
  try {
    const status = await getConnectionStatus();
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/auth-url', (req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gmail not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing authorization code');
    const email = await handleCallback(code);
    // Redirect back to frontend settings page (use frontend origin in dev)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings/gmail?gmail=connected&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('Gmail callback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings/gmail?gmail=error`);
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    await disconnect();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
