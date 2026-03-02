// index.js (ROOT LEVEL)
import { createEdgeRouter } from 'next-http-edge-runtime'; // or use standard handler
// OR minimal proxy handler:
export default async function handler(req) {
  // Forward ALL traffic to your /api/index.js logic
  const apiUrl = new URL(req.url, `http://${req.headers.host}`);
  apiUrl.pathname = apiUrl.pathname.replace(/^\/api\/?/, '/api/') || '/api/';
  
  const response = await fetch(apiUrl.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
