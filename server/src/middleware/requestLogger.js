import logger from '../lib/logger.js';

export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}
