export default function handler(req, res) {
  res.status(404).json({
    error: {
      message: `Endpoint ${req.url} not found`,
      type: 'invalid_request_error',
      code: 404
    }
  });
}
