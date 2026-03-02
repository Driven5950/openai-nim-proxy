// index.js (PROJECT ROOT - same level as package.json)
export default async function handler(req, res) {
  try {
    // Forward to /api/index.js logic or handle directly
    if (req.url === '/health' || req.method === 'GET') {
      return res.status(200).json({ status: 'ok' });
    }
    
    if (req.method === 'POST' && req.url.includes('/chat/completions')) {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body)
      });
      
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
