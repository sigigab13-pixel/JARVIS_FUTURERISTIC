const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
const MODEL = process.env.HF_MODEL || 'openai/gpt-oss-120b:fastest';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
  if (!token) {
    return res.status(503).json({
      error: 'JARVIS AI core is not configured yet. Add HUGGINGFACE_API_TOKEN in Vercel Environment Variables.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const safeMessages = messages
      .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-16)
      .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (!safeMessages.length) {
      return res.status(400).json({ error: 'No message was provided.' });
    }

    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are JARVIS, Saviour\'s futuristic AI assistant. Be helpful, clear, concise, and honest about your capabilities. Do not claim to have performed actions you cannot actually perform.',
          },
          ...safeMessages,
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.error?.message || data?.error || 'Hugging Face AI request failed.';
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: String(message) });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({ error: 'The AI core returned no text.' });

    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'JARVIS AI core failed.' });
  }
}
