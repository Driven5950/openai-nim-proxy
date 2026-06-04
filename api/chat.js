const axios = require('axios');

const NIM_API_BASE = 'https://integrate.api.nvidia.com/v1';
const SHOW_REASONING = true;
const ENABLE_THINKING_MODE = true;

const MODEL_MAPPING = {
  'minimaxai/minimax-m2.5': 'minimaxai/minimax-m2.5',
  'qwen/qwen3.5-397b-a17b': 'qwen/qwen3.5-397b-a17b',
  'z-ai/glm5': 'z-ai/glm5',
  'minimaxai/minimax-m2.1': 'minimaxai/minimax-m2.1',
  'stepfun-ai/step-3.5-flash': 'stepfun-ai/step-3.5-flash',
  'moonshotai/kimi-k2.5': 'moonshotai/kimi-k2.5',
  'moonshotai/kimi-k2.6': 'moonshotai/kimi-k2.6',
  'z-ai/glm-4.7': 'z-ai/glm-4.7',
  'deepseek-ai/deepseek-v3.2': 'deepseek-ai/deepseek-v3.2',
  'deepseek-ai/deepseek-v3.1-terminus': 'deepseek-ai/deepseek-v3.1-terminus',
  'qwen/qwen3-next-80b-a3b-instruct': 'qwen/qwen3-next-80b-a3b-instruct',
  'mistralai/devstral-2-123b-instruct-2512': 'mistralai/devstral-2-123b-instruct-2512',
  'mistralai/mistral-large-3-675b-instruct-2512': 'mistralai/mistral-large-3-675b-instruct-2512',
  'qwen/qwen3-coder-480b-a35b-instruct': 'qwen/qwen3-coder-480b-a35b-instruct',
  'deepseek-ai/deepseek-v4-pro': 'deepseek-ai/deepseek-v4-pro',
  'deepseek-ai/deepseek-v4-flash': 'deepseek-ai/deepseek-v4-flash',
  'mistralai/mistral-medium-3.5-128b': 'mistralai/mistral-medium-3.5-128b',
  'z-ai/glm-5.1': 'z-ai/glm-5.1',
  'qwen/qwen3.5-122b-a10b': 'qwen/qwen3.5-122b-a10b',
  'nvidia/nemotron-3-super-120b-a12b': 'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b': 'nvidia/nemotron-3-ultra-550b-a55b'
};

// Kimi on NIM: thinking is ON by default, do NOT send chat_template_kwargs.
// When thinking is default-on, NIM streams reasoning in delta.reasoning and
// mirrors it with <think> tags already embedded in delta.content.
// Just strip delta.reasoning and pass delta.content through untouched.
//
// Other models use a separate reasoning_content field which we wrap ourselves.

function getThinkingKwargs(nimModel) {
  // Kimi: thinking on by default — sending chat_template_kwargs disrupts streaming
  if (nimModel.includes('kimi')) return null;

  if (nimModel.includes('deepseek-v4')) return { thinking: true };
  if (nimModel.includes('glm5') || nimModel.includes('glm-5') || nimModel.includes('glm4.7') || nimModel.includes('glm-4.7')) {
    return { enable_thinking: true, clear_thinking: false };
  }
  if (nimModel.includes('qwen3') || nimModel.includes('qwq')) return { enable_thinking: true };
  if (nimModel.includes('deepseek-v3') || nimModel.includes('deepseek-r1')) return { thinking: true };
  if (nimModel.includes('minimax')) return null;
  return null;
}

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

    const isDeepSeekV4 = nimModel.includes('deepseek-v4');
    const isKimi = nimModel.includes('kimi');
    const thinkingKwargs = ENABLE_THINKING_MODE ? getThinkingKwargs(nimModel) : null;

    const nimRequest = {
      model: nimModel,
      messages,
      temperature: temperature || 0.6,
      max_tokens: max_tokens || 9024,
      stream: stream || false,
      ...(isDeepSeekV4 && { reasoning_effort: 'max' }),
      ...(thinkingKwargs && { chat_template_kwargs: thinkingKwargs })
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
      let inReasoning = false;

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
              const delta = data.choices[0].delta;

              if (isKimi) {
                // Kimi streams thinking already inside delta.content with <think> tags.
                // delta.reasoning is a redundant mirror — delete it, pass content through.
                delete delta.reasoning;
                delete delta.reasoning_content;
              } else {
                // DeepSeek-style: wrap reasoning_content in <think> tags ourselves.
                const reasoning = delta.reasoning_content;
                const content = delta.content;
                let output = '';
                if (reasoning) {
                  if (!inReasoning) { output += '<think>'; inReasoning = true; }
                  output += reasoning;
                }
                if (content !== null && content !== undefined && content !== '') {
                  if (inReasoning) { output += '</think>\n\n'; inReasoning = false; }
                  output += content;
                }
                delta.content = output;
                delete delta.reasoning_content;
                delete delta.reasoning;
              }
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
        let content = choice.message?.content || '';
        const reasoning = choice.message?.reasoning_content || choice.message?.reasoning || '';
        if (reasoning && !content.includes('<think>')) {
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
