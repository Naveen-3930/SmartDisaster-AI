// routes/chat.js
const express = require('express');
const { verifyToken } = require('../middleware');

const router = express.Router();

const SYSTEM_PROMPT = `You are the SmartDisaster AI assistant, a helpful chat widget embedded inside the SmartDisaster AI web app.
You help users with three things:
1. Disaster safety tips and guidance (floods, fires, heatwaves, earthquakes, storms).
2. Explaining how to use the app itself — reporting an incident, checking alerts, finding nearby shelters, sending an SOS, viewing risk predictions.
3. General questions about the app's features.

Keep answers short, clear, and practical — this is a mobile-friendly chat widget, not a long-form article. Use plain language. If someone describes an active life-threatening emergency, tell them clearly to contact local emergency services immediately and use the app's SOS feature, before anything else.
You do not have access to the user's live data (their specific incidents, location, or account) — you can only give general guidance and explain how features work.`;

router.post('/', verifyToken, async (req, res) => {
    const { message, history } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Chat is not configured on the server (missing API key)' });
    }

    const messages = Array.isArray(history)
        ? history.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
        : [];
    messages.push({ role: 'user', content: message.trim() });

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 500,
                system: SYSTEM_PROMPT,
                messages,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic API error:', data);
            return res.status(502).json({ error: 'Chat service error' });
        }

        const reply = (data.content || [])
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');

        res.status(200).json({ reply });
    } catch (err) {
        console.error('Chat request failed:', err);
        res.status(500).json({ error: 'Failed to reach chat service' });
    }
});

module.exports = router;