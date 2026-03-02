module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).json({
    status: 'ok',
    proxy: 'NIM -> OpenAI',
    endpoints: {
      models: '/v1/models',
      chat: '/v1/chat/completions'
    }
  });
};
