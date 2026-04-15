import mongoose from 'mongoose';

export function errorHandler(err, req, res, next) {
  const message = err?.message || 'Internal server error';

  console.error('Error:', message);

  if (err?.name === 'ValidationError' || err?.name === 'CastError' || err?.name === 'BSONError') {
    return res.status(400).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
  }

  if (
    err instanceof mongoose.Error.MongooseServerSelectionError ||
    /ECONNREFUSED|timed out|Topology is closed|failed to connect/i.test(message)
  ) {
    return res.status(503).json({
      error: 'Database is temporarily unavailable. Please retry shortly.'
    });
  }

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}
