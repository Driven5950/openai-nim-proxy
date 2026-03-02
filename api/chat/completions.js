const NIM_BASE = 'https://integrate.api.nvidia.com/v1';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = (req.headers['authorization'] || '').replace('Bearer ', '').trim() || process.env.NIM_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' });

  const body = req.body || {};
  body.thinking = false;
  if (body.reasoning === undefined) body.reasoning = true;

  const isStream = !!body.stream;

  let nimRes;
  try {
    nimRes = await fetch(`${NIM_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('NIM fetch error:', err);
    return res.status(502).json({ error: 'Failed to reach NIM API', detail: err.message });
  }

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(nimRes.status);
    const reader = nimRes.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(Buffer.from(value));
      }
    };
    return pump().catch(() => res.end());
  }

  const data = await nimRes.json();
  return res.status(nimRes.status).json(data);
};
