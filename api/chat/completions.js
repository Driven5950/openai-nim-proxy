export const config = { runtime: 'edge' };

const NIM_BASE = 'https://integrate.api.nvidia.com/v1';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = req.headers.get('authorization')?.replace('Bearer ', '') || process.env.NIM_API_KEY;
  if (!apiKey) return json({ error: 'Missing API key' }, 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Enforce: thinking OFF, reasoning ON
  body.thinking = false;
  if (body.reasoning === undefined) body.reasoning = true;

  const nimRes = await fetch(`${NIM_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = nimRes.headers.get('content-type') || '';

  if (body.stream) {
    return new Response(nimRes.body, {
      status: nimRes.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const data = await nimRes.json();
  return json(data, nimRes.status);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}
