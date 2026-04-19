const { sendError } = require('../utils/response');

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  enabled: String(process.env.CHAT_RATE_LIMIT_ENABLED || 'true').toLowerCase() === 'true',
  windowMs: toPositiveInt(process.env.CHAT_RATE_WINDOW_MS, 60_000),
  maxPerWindow: toPositiveInt(process.env.CHAT_RATE_MAX_PER_WINDOW, 12),
  warnAtPercent: toPositiveInt(process.env.CHAT_RATE_WARN_PERCENT, 75),
  reliefMs: toPositiveInt(process.env.CHAT_RATE_RELIEF_MS, 120_000)
};

const buckets = new Map();

function getKey(req) {
  if (req.user?.id) return `guest:${req.user.id}`;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return `ip:${forwarded || req.ip || 'unknown'}`;
}

function getBucket(key, now) {
  const existing = buckets.get(key);
  if (existing && now - existing.windowStart < config.windowMs) {
    return existing;
  }

  // Check relief: if previous window hit the limit, enforce cooldown
  if (existing && existing.limited && now - existing.limitedAt < config.reliefMs) {
    return existing; // still in relief period
  }

  const fresh = {
    windowStart: now,
    count: 0,
    limited: false,
    limitedAt: null,
    warned: false
  };
  buckets.set(key, fresh);
  return fresh;
}

function cleanup() {
  if (buckets.size <= 5000) return;
  const now = Date.now();
  const cutoff = config.reliefMs + config.windowMs;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > cutoff) {
      buckets.delete(key);
    }
  }
}

function chatRateLimit(req, res, next) {
  if (!config.enabled) return next();

  const now = Date.now();
  cleanup();

  const key = getKey(req);
  const bucket = getBucket(key, now);

  // Relief period active — blocked with countdown
  if (bucket.limited) {
    const reliefEndsAt = bucket.limitedAt + config.reliefMs;
    if (now < reliefEndsAt) {
      const secsLeft = Math.ceil((reliefEndsAt - now) / 1000);
      res.setHeader('Retry-After', String(secsLeft));
      return sendError(
        res, 429,
        `Previše poruka u kratkom roku. Možete nastaviti za ${secsLeft} sekundi.`
      );
    }
    // Relief expired — reset
    bucket.windowStart = now;
    bucket.count = 0;
    bucket.limited = false;
    bucket.limitedAt = null;
    bucket.warned = false;
  }

  bucket.count += 1;

  // Hit the limit — activate relief period
  if (bucket.count > config.maxPerWindow) {
    bucket.limited = true;
    bucket.limitedAt = now;
    const secsLeft = Math.ceil(config.reliefMs / 1000);
    res.setHeader('Retry-After', String(secsLeft));
    return sendError(
      res, 429,
      `Previše poruka u kratkom roku. Možete nastaviti za ${secsLeft} sekundi.`
    );
  }

  // Warning zone — approaching limit
  const warnThreshold = Math.ceil(config.maxPerWindow * config.warnAtPercent / 100);
  if (bucket.count >= warnThreshold && !bucket.warned) {
    bucket.warned = true;
    const remaining = config.maxPerWindow - bucket.count;
    res.setHeader('X-Chat-Rate-Warning', `Imate jos ${remaining} poruka u ovom periodu.`);
  }

  const remaining = Math.max(0, config.maxPerWindow - bucket.count);
  res.setHeader('X-Chat-Rate-Limit', String(config.maxPerWindow));
  res.setHeader('X-Chat-Rate-Remaining', String(remaining));

  return next();
}

module.exports = { chatRateLimit };
