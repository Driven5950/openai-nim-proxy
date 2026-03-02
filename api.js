module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Health check
  if (req.url === '/api/health') {
    res.json({ status: 'ok', service: 'NIM Proxy' });
    return;
  }

  // Models list
  if (req.url === '/api/v1/models') {
    res.json({
      object: 'list',
      data: [
        { id: 'moonshotai/kimi-k2.5', object: 'model' },
        { id: 'minimaxai/minimax-m2.5', object: 'model' },
        { id: 'deepseek-ai/deepseek-v3_2', object: 'model' },
        { id: 'z-ai/glm4_7', object: 'model' }
      ]
    });
    return;
  }

  // Chat completions - FIXED body parsing
  if (req.method === 'POST' && req.url === '/api/v1/chat/completions') {
    // Read ALL body data first
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    
    const body = Buffer.concat(buffers).toString();
    const data = JSON.parse(body);
    
    try {
      const nimResp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await nimResp.json();
      res.status(nimResp.status).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // 404
  res.status(404).json({ error: 'Endpoint not found' });
};
