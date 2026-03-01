export default async function handler(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    res.json({ 
      status: 'ok', 
      service: 'NIM Proxy' 
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
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
    
    res.json({
      object: 'list',
      data: models.map(id => ({ id, object: 'model', created: Date.now(), owned_by: 'nim-proxy' }))
    });
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/v1/chat/completions')) {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
      });

      const { model, messages, temperature, max_tokens, stream } = body;
      
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
          stream: stream || false
        })
      });

      const data = await nimResponse.json();
      
      res.status(nimResponse.status).json(data);
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
    }
  } else {
    res.status(404).json({ error: { message: 'Endpoint not found', code: 404 } });
  }
}
