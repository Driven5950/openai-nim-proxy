// index.js (PROJECT ROOT)
export default async function handler(req, res) {
  try {
    console.log('Request URL:', req.url, 'Method:', req.method);
    
    if (req.url === '/health' || req.method === 'GET') {
      return res.status(200).json({ status: 'ok' });
    }
    
    if (req.method === 'POST' && req.url.includes('/chat/completions')) {
      // CRITICAL: Parse body correctly for Vercel
      let body;
      try {
        body = await getBody(req);  // Helper below
      } catch (e) {
        console.error('Body parse error:', e);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
      
      console.log('Proxying to Nvidia with body:', JSON.stringify(body).slice(0, 200));
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      
      console.log('Nvidia response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Nvidia error:', errorData);
        return res.status(response.status).json({ error: errorData });
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    }
    
    res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Helper to read Vercel request body
async function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}
