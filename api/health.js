export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'OpenAI to NVIDIA NIM Proxy',
    reasoning_display: true,
    thinking_mode: false
  });
}
