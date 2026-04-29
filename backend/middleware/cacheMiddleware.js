const cacheService = require('../services/cacheService');

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
    } else {
      // Intercept the res.json method
      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Cache the body before sending
        cacheService.set(key, body, duration);
        originalJson(body);
      };
      next();
    }
  };
}

module.exports = cacheMiddleware;
