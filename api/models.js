export const config = { runtime: 'edge' };

const MODELS = [
  { id: 'minimaxai/minimax-m2.5',                          owned_by: 'minimaxai' },
  { id: 'qwen/qwen3.5-397b-a17b',                          owned_by: 'qwen' },
  { id: 'z-ai/glm5',                                       owned_by: 'z-ai' },
  { id: 'minimaxai/minimax-m2.1',                          owned_by: 'minimaxai' },
  { id: 'stepfun-ai/step-3.5-flash',                       owned_by: 'stepfun-ai' },
  { id: 'moonshotai/kimi-k2.5',                            owned_by: 'moonshotai' },
  { id: 'z-ai/glm4.7',                                     owned_by: 'z-ai' },
  { id: 'deepseek-ai/deepseek-v3.2',                       owned_by: 'deepseek-ai' },
  { id: 'deepseek-ai/deepseek-v3.1-terminus',              owned_by: 'deepseek-ai' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct',                owned_by: 'qwen' },
  { id: 'mistralai/devstral-2-123b-instruct-2512',         owned_by: 'mistralai' },
  { id: 'mistralai/mistral-large-3-675b-instruct-2512',    owned_by: 'mistralai' },
  { id: 'qwen/qwen3-coder-480b-a35b-instruct',             owned_by: 'qwen' },
];

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const data = {
    object: 'list',
    data: MODELS.map(m => ({
      id: m.id,
      object: 'model',
      created: 1700000000,
      owned_by: m.owned_by,
    })),
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
