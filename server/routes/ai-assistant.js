import { Router } from 'express';
import { chatWithAssistant } from '../services/claude.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [], pageContext = {} } = req.body;
    if (!message) return res.status(400).json({ message: 'message required' });

    const reply = await chatWithAssistant(conversationHistory, message, pageContext);
    res.json({ reply });
  } catch (err) {
    console.error('AI assistant error:', err);
    res.status(500).json({ message: err.message || 'AI assistant failed' });
  }
});

export default router;
