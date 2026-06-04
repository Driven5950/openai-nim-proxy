// server.js - OpenAI to NVIDIA NIM API Proxy
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// NVIDIA NIM API configuration
const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

const SHOW_REASONING = true;
const ENABLE_THINKING_MODE = true;

// Model mapping — kept in sync with api/models.js and api/chat.js
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
  'nvidia/nemotron-3-super-120b-a12b': 'nvidia/nemotron-3-super-120b-a12b'
  'nvidia/nemotron-3-ultra-550b-a55b': 'nvidia/nemotron-3-ultra-550b-a55b'

};

// Per-model chat_template_kwargs for enabling thinking on NVIDIA NIM
function getThinkingKwargs(nimModel) {
  if (nimModel.includes('deepseek-v4')) {
    return { thinking: true };
  }
  if (nimModel.includes('glm5') || nimModel.includes('glm-5') || nimModel.includes('glm4.7') || nimModel.includes('glm-4.7')) {
    return { enable_thinking: true, clear_thinking: false };
  }
  if (nimModel.includes('kimi')) {
    return { thinking: true };
  }
  if (nimModel.includes('qwen3') || nimModel.includes('qwq')) {
    return { enable_thinking: true };
  }
  if (nimModel.includes('deepseek-v3') || nimModel.includes('deepseek-r1')) {
    return { thinking: true };
  }
  if (nimModel.includes('minimax')) return null;
  return null;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OpenAI to NVIDIA NIM Proxy',
    reasoning_display: SHOW_REASONING,
    thinking_mode: ENABLE_THINKING_MODE
  });
});

// List models endpoint (OpenAI compatible)
app.get('/v1/models', (req, res) => {
  const models = Object.keys(MODEL_MAPPING).map(model => ({
    id: model,
    object: 'model',
    created: Date.now(),
    owned_by: 'nvidia-nim-proxy'
  }));
  res.json({ object: 'list', data: models });
});

// Chat completions endpoint (main proxy)
app.post('/v1/chat/completions', async (req, res) => {
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
      'Authorization': `Bearer ${NIM_API_KEY}`,
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
              const reasoning = data.choices[0].delta.reasoning_content;
              let content = data.choices[0].delta.content;

              let output = '';
              if (reasoning) {
                if (!inReasoning) { output += '<think>'; inReasoning = true; }
                output += reasoning;
              }
              if (content !== null && content !== undefined && content !== '') {
                if (inReasoning) { output += '</think>\n\n'; inReasoning = false; }
                // Strip any inline <think> blocks the model emitted inside content
                content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
                if (content) output += content;
              }

              data.choices[0].delta.content = output;
              delete data.choices[0].delta.reasoning_content;
            }
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (e) {
            res.write(line + '\n');
          }
        });
      });

      response.data.on('end', () => res.end());
      response.data.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });

    } else {
      const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, { headers });

      const choices = response.data.choices.map(choice => {
        let content = choice.message?.content || '';
        const reasoning = choice.message?.reasoning_content || '';

        // Strip inline <think> blocks from content to avoid duplication
        content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '');

        if (reasoning) {
          content = '<think>\n' + reasoning + '\n</think>\n\n' + content;
        }
        return {
          index: choice.index,
          message: { role: choice.message.role, content },
          finish_reason: choice.finish_reason
        };
      });

      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices,
        usage: response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    }

  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'invalid_request_error',
        code: error.response?.status || 500
      }
    });
  }
});

// Catch-all for unsupported endpoints
app.all('*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Endpoint ${req.path} not found`,
      type: 'invalid_request_error',
      code: 404
    }
  });
});

app.listen(PORT, () => {
  console.log(`OpenAI to NVIDIA NIM Proxy running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Reasoning display: ${SHOW_REASONING ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Thinking mode: ${ENABLE_THINKING_MODE ? 'ENABLED' : 'DISABLED'}`);
});
