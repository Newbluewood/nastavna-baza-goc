const cacheService = require('../services/cacheService');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * After a successful admin write, drop the in-memory public API cache
 * so CMS edits are visible without waiting for TTL or manual purge.
 */
function invalidatePublicCacheOnWrite(req, res, next) {
  if (!MUTATING.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      cacheService.clear();
    }
  });

  next();
}

module.exports = invalidatePublicCacheOnWrite;
