const cacheService = require('../services/cacheService');

function isCacheableSuccess(res, body) {
  const status = res.statusCode || 200;
  if (status < 200 || status >= 300) return false;

  // Never cache bare error payloads (e.g. errorHandler after a DB blip).
  if (
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && typeof body.error === 'string'
    && Object.keys(body).length === 1
  ) {
    return false;
  }

  return true;
}

function cacheMiddleware(duration = 5 * 60 * 1000) {
  return (req, res, next) => {
    // We only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Use URL and query params as the cache key
    const key = `__express__${req.originalUrl || req.url}`;
    const cachedBody = cacheService.get(key);

    if (cachedBody) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedBody);
    }

    // Intercept the res.json method
    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (isCacheableSuccess(res, body)) {
        cacheService.set(key, body, duration);
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = cacheMiddleware;
