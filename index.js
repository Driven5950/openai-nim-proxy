// index.js (PROJECT ROOT)
export default async function handler(req, res) {
  try {
    console.log('URL:', req.url, 'Method:', req.method);
    
    if (req.url === '/health') {
      return res.status(200).json({ status: 'ok' });
    }
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    if (req.method === 'POST' && req.url.includes('chat/completions')) {
      // Method 1: Use Vercel's built-in bodyParser (default)
      let body = req.body;
      
      // Method 2: Fallback - manual buffer parsing
      if (!body || Object.keys(body).length === 0) {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const rawBody = Buffer.concat(buffers).toString();
        console.log('Raw body (first 200 chars):', rawBody.slice(0, 200));
        body = rawBody ? JSON.parse(rawBody) : {};
      }
      
      console.log('Final body model:', body.model, 'Messages count:', body.messages?.length);
      
      const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      
      console.log('Nvidia status:', nvidiaResponse.status);
      
      if (!nvidiaResponse.ok) {
        const errorText = await nvidiaResponse.text();
        console.error('Nvidia error:', errorText);
        return res.status(nvidiaResponse.status).json({ error: errorText });
      }
      
      const data = await nvidiaResponse.json();
      return res.status(200).json(data);
    }
    
    res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('ERROR:', error.message, error.stack);
    res.status(500).json({ error: 'Internal error: ' + error.message });
  }
}
