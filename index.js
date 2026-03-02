export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);

  // Root — return status JSON
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(JSON.stringify({
      status: 'ok',
      proxy: 'NIM → OpenAI',
      endpoints: {
        models: '/v1/models',
        chat: '/v1/chat/completions'
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
