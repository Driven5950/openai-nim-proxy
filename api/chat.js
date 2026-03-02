const axios = require('axios');

const NIM_API_BASE = 'https://integrate.api.nvidia.com/v1';
const SHOW_REASONING = true;
const ENABLE_THINKING_MODE = false;

const MODEL_MAPPING = {
  'minimaxai/minimax-m2.5': 'minimaxai/minimax-m2.5',
  'qwen/qwen3.5-397b-a17b': 'qwen/qwen3.5-397b-a17b',
  'z-ai/glm5': 'z-ai/glm5',
  'minimaxai/minimax-m2.1': 'minimaxai/minimax-m2.1',
  'stepfun-ai/step-3.5-flash': 'stepfun-ai/step-3.5-flash',
  'moonshotai/kimi-k2.5': 'moonshotai/kimi-k2.5',
  'z-ai/glm4.7': 'z-ai/glm4.7',
  'deepseek-ai/deepseek-v3.2': 'deepseek-ai/deepseek-v3.2',
  'deepseek-ai/deepseek-v3.1-terminus': 'deepseek-ai/deepseek-v3.1-terminus',
  'qwen/qwen3-next-80b-a3b-instruct': 'qwen/qwen3-next-80b-a3b-instruct',
  'mistralai/devstral-2-123b-instruct-2512': 'mistralai/devstral-2-123b-instruct-2512',
  'mistralai/mistral-large-3-675b-instruct-2512': 'mistralai/mistral-large-3-675b-instruct-2512',
  'qwen/qwen3-coder-480b-a35b-instruct': 'qwen/qwen3-coder-480b-a35b-instruct'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request_error' } });
  }

  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;

    let nimModel = MODEL_MAPPING[model];
    if (!nimModel) {
      const lower = (model || '').toLowerCase();
      if (lower.includes('gpt-4') || lower.includes('claude-opus') || lower.includes('405b')) {
        nimModel = 'meta/llama-3.1-405b-instruct';
      } else if (lower.includes('claude') || lower.includes('gemini') || lower.includes('70b')) {
        nimModel = 'meta/llama-3.1-70b-instruct';
      } else {
        nimModel = 'meta/llama-3.1-8b-instruct';
      }
    }

    const nimRequest = {
      model: nimModel,
      messages,
      temperature: temperature || 0.6,
      max_tokens: max_tokens || 9024,
      stream: stream || false,
      ...(ENABLE_THINKING_MODE && { extra_body: { chat_template_kwargs: { thinking: true } } })
    };

    const headers = {
      'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
      'Content-Type': 'application/json'
    };

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, {
        headers,
        responseType: 'stream'
      });

      let buffer = '';
      let reasoningStarted = false;
      let reasoningBuffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        lines.forEach(line => {
          if (!line.startsWith('data: ')) return;
          if (line.includes('[DONE]')) { res.write(line + '\n'); return; }

          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices?.[0]?.delta) {
              const reasoning = data.choices[0].delta.reasoning_content;
              const content = data.choices[0].delta.content;

              if (SHOW_REASONING) {
                // If content already has think tags embedded, pass through as-is
                if (content && content.includes('<think>')) {
                  data.choices[0].delta.content = content;
                } else {
                  let combined = '';
                  if (reasoning && !reasoningStarted) {
                    combined = '<think>\n' + reasoning;
                    reasoningStarted = true;
                    reasoningBuffer = reasoning;
                  } else if (reasoning) {
                    combined = reasoning;
                    reasoningBuffer += reasoning;
                  }
                  if (content && reasoningStarted) {
                    const cleanContent = content.replace(reasoningBuffer, '').trim();
                    combined += '</think>\n\n' + cleanContent;
                    reasoningStarted = false;
                    reasoningBuffer = '';
                  } else if (content) {
                    combined += content;
                  }
                  if (combined) data.choices[0].delta.content = combined;
                }
              } else {
                data.choices[0].delta.content = content || '';
              }
              delete data.choices[0].delta.reasoning_content;
            }
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (e) {
            res.write(line + '\n');
          }
        });
      });

      response.data.on('end', () => res.end());
      response.data.on('error', () => res.end());

    } else {
      const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, { headers });

      const choices = response.data.choices.map(choice => {
        let reasoning = choice.message?.reasoning_content || '';
        let content = choice.message?.content || '';
        // If content already has think tags embedded, pass through as-is
        if (content.includes('<think>')) {
          // do nothing, already formatted
        } else if (SHOW_REASONING && reasoning) {
          content = '<think>\n' + reasoning + '\n</think>\n\n' + content;
        }
        return {
          index: choice.index,
          message: { role: choice.message.role, content },
          finish_reason: choice.finish_reason
        };
      });

      res.status(200).json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices,
        usage: response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    }

  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      error: { message: error.message || 'Internal server error', type: 'invalid_request_error', code: status }
    });
  }
}
