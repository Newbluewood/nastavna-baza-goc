const { sendError } = require('../utils/response');

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  enabled: String(process.env.AI_RATE_LIMIT_ENABLED || 'true').toLowerCase() === 'true',
  maxPerMinuteGlobal: toPositiveInt(process.env.AI_MAX_REQUESTS_PER_MINUTE_GLOBAL, 20),
  maxPerHourPerUser: toPositiveInt(process.env.AI_MAX_REQUESTS_PER_USER_PER_HOUR, 60),
  maxPerDayGlobal: toPositiveInt(process.env.AI_MAX_REQUESTS_PER_DAY_GLOBAL, 500)
};

const state = {
  minuteWindowStart: Date.now(),
  minuteCount: 0,
  dayKey: new Date().toISOString().slice(0, 10),
  dayCount: 0,
  userHourly: new Map()
};

function resetMinuteWindowIfNeeded(now) {
  if (now - state.minuteWindowStart >= 60_000) {
    state.minuteWindowStart = now;
    state.minuteCount = 0;
  }
}

function resetDayWindowIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== state.dayKey) {
    state.dayKey = today;
    state.dayCount = 0;
    state.userHourly.clear();
  }
}

function getUserBucket(userKey, now) {
  const existing = state.userHourly.get(userKey);
  if (!existing || now - existing.windowStart >= 3_600_000) {
    const fresh = { windowStart: now, count: 0 };
    state.userHourly.set(userKey, fresh);
    return fresh;
  }
  return existing;
}

function aiUsageGuard(req, res, next) {
  if (!config.enabled) {
    return next();
  }

  const now = Date.now();
  resetMinuteWindowIfNeeded(now);
  resetDayWindowIfNeeded();

  const userKey = req.user?.id ? `admin:${req.user.id}` : `ip:${req.ip || 'unknown'}`;
  const userBucket = getUserBucket(userKey, now);

  if (state.dayCount >= config.maxPerDayGlobal) {
    return sendError(res, 429, 'AI daily budget limit reached. Try again tomorrow.');
  }

  if (state.minuteCount >= config.maxPerMinuteGlobal) {
    return sendError(res, 429, 'AI request rate is too high. Please try again in a minute.');
  }

  if (userBucket.count >= config.maxPerHourPerUser) {
    return sendError(res, 429, 'AI per-user hourly limit reached. Please try again later.');
  }

  state.minuteCount += 1;
  state.dayCount += 1;
  userBucket.count += 1;

  res.setHeader('X-AI-Limit-Global-Minute', String(config.maxPerMinuteGlobal));
  res.setHeader('X-AI-Remaining-Global-Minute', String(Math.max(config.maxPerMinuteGlobal - state.minuteCount, 0)));
  res.setHeader('X-AI-Limit-User-Hour', String(config.maxPerHourPerUser));
  res.setHeader('X-AI-Remaining-User-Hour', String(Math.max(config.maxPerHourPerUser - userBucket.count, 0)));
  res.setHeader('X-AI-Limit-Global-Day', String(config.maxPerDayGlobal));
  res.setHeader('X-AI-Remaining-Global-Day', String(Math.max(config.maxPerDayGlobal - state.dayCount, 0)));

  return next();
}

module.exports = {
  aiUsageGuard
};
