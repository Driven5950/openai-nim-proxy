const fetch = require('node-fetch'); // Vercel includes this

module.exports = async (req, res) => {
  // Health check
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({ 
      status: 'ok', 
      service: 'NIM Proxy' 
    }));
    return;
  }

  // List models
  if (req.url.startsWith('/v1/models')) {
    const models = [
      'moonshotai/kimi-k2.5',
      'moonshotai/kimi-k2-instruct-0905',
      'minimaxai/minimax-m2.5',
      'minimaxai/minimax-m2.1',
      'deepseek-ai/deepseek-v3_2',
      'deepseek-ai/deepseek-v3_1-terminus',
      'qwen/qwen3.5-397b-a17b',
      'qwen/qwen3-coder-480b-a35b-instruct',
      'openai/gpt-oss-120b',
      'z-ai/glm4_7'
    ];
    
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({
      object: 'list',
      data: models.map(id => ({ 
        id, 
        object: 'model', 
        created: Date.now(), 
        owned_by: 'nim-proxy' 
      }))
    }));
    return;
  }

  // Chat completions
  if (req.url.startsWith('/v1/chat/completions') && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      
      req.on('end', async () => {
        const data = JSON.parse(body);
        const { model, messages, temperature, max_tokens, stream } = data;

        const nimResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': req.headers.authorization,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model || 'moonshotai/kimi-k2.5',
            messages,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 2048,
            stream: false  // Disable streaming to fix truncation
          })
        });

        const result = await nimResponse.json();
        res.status(nimResponse.status).json(result);
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
    }
  } else {
    res.status(404).json({ error: { message: 'Endpoint not found', code: 404 } });
  }
};
