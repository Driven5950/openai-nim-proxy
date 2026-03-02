export default function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
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
