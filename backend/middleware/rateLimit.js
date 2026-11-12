/**
 * Simple in-memory IP (or guest) rate limiter for auth / inquiry abuse.
 * Per-process only — fine for a single Render instance.
 */
const { sendError } = require('../utils/response');

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req) {
  if (req.user?.id) return `guest:${req.user.id}`;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return `ip:${forwarded || req.ip || 'unknown'}`;
}

/**
 * @param {object} options
 * @param {string} options.name — prefix for env vars and headers (e.g. login, inquiry)
 * @param {number} [options.windowMs]
 * @param {number} [options.max]
 * @param {string} [options.message]
 * @param {boolean} [options.enabled]
 */
function createRateLimit(options = {}) {
  const name = options.name || 'api';
  const envPrefix = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_');

  const config = {
    enabled:
      options.enabled !== undefined
        ? Boolean(options.enabled)
        : String(process.env[`${envPrefix}_RATE_LIMIT_ENABLED`] || process.env.API_RATE_LIMIT_ENABLED || 'true')
          .toLowerCase() !== 'false',
    windowMs: toPositiveInt(
      options.windowMs ?? process.env[`${envPrefix}_RATE_WINDOW_MS`] ?? process.env.API_RATE_WINDOW_MS,
      60_000
    ),
    max: toPositiveInt(
      options.max ?? process.env[`${envPrefix}_RATE_MAX`] ?? process.env.API_RATE_MAX,
      10
    ),
    message:
      options.message
      || process.env[`${envPrefix}_RATE_MESSAGE`]
      || 'Previše zahteva. Pokušajte ponovo za malo.',
  };

  const buckets = new Map();

  function cleanup(now) {
    if (buckets.size <= 5000) return;
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > config.windowMs) {
        buckets.delete(key);
      }
    }
  }

  function middleware(req, res, next) {
    if (!config.enabled) return next();

    const now = Date.now();
    cleanup(now);

    const key = clientKey(req);
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart >= config.windowMs) {
      bucket = { windowStart: now, count: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, config.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(config.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > config.max) {
      const retryAfter = Math.ceil((bucket.windowStart + config.windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      return sendError(res, 429, config.message);
    }

    return next();
  }

  /** Test helper — clear buckets between cases. */
  middleware._reset = () => buckets.clear();
  middleware._config = config;

  return middleware;
}

const loginRateLimit = createRateLimit({
  name: 'login',
  max: 10,
  windowMs: 60_000,
  message: 'Previše pokušaja prijave. Sačekajte minut pa pokušajte ponovo.',
});

const inquiryRateLimit = createRateLimit({
  name: 'inquiry',
  max: 20,
  windowMs: 60_000,
  message: 'Previše zahteva za rezervaciju. Sačekajte minut pa pokušajte ponovo.',
});

module.exports = {
  createRateLimit,
  loginRateLimit,
  inquiryRateLimit,
};
