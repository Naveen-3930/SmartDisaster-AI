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

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

router.post('/', verifyToken, async (req, res) => {
    const { message, history } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
    }

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(Array.isArray(history)
            ? history.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
            : []),
        { role: 'user', content: message.trim() },
    ];

    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Ollama error:', errText);
            return res.status(502).json({ error: 'Chat service error' });
        }

        const data = await response.json();
        const reply = data?.message?.content || '';

        res.status(200).json({ reply });
    } catch (err) {
        console.error('Chat request failed:', err);
        return res.status(500).json({ error: 'Failed to reach chat service. Is Ollama running?' });
    }
});

module.exports = router;