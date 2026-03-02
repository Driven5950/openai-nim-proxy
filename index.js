// index.js (PROJECT ROOT)
export default async function handler(req, res) {
  try {
    console.log('Request URL:', req.url, 'Method:', req.method);
    
    if (req.url === '/health' || req.method === 'GET') {
      return res.status(200).json({ status: 'ok' });
    }
    
    if (req.method === 'POST' && req.url.includes('/chat/completions')) {
      // Vercel auto-parses JSON body - just use it directly
      const body = req.body || {};
      console.log('Received body:', JSON.stringify(body).slice(0, 200));
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      
      console.log('Nvidia response status:', response.status);
      
      const data = await response.json();
      return res.status(response.status).json(data);
    }
    
    res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('Full error:', error);
    res.status(500).json({ error: error.message });
  }
}
