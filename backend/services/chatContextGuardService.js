function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  enabled: String(process.env.AI_CHAT_CONTEXT_GUARD_ENABLED || 'true').toLowerCase() === 'true',
  warnThreshold: toPositiveInt(process.env.AI_CHAT_OOD_WARN_THRESHOLD, 3),
  strictThreshold: toPositiveInt(process.env.AI_CHAT_OOD_STRICT_THRESHOLD, 5),
  lockThreshold: toPositiveInt(process.env.AI_CHAT_OOD_LOCK_THRESHOLD, 8),
  lockMs: toPositiveInt(process.env.AI_CHAT_OOD_LOCK_MS, 7_200_000),
  decayMs: toPositiveInt(process.env.AI_CHAT_OOD_DECAY_MS, 21_600_000),
  maxEntries: toPositiveInt(process.env.AI_CHAT_CONTEXT_GUARD_MAX_ENTRIES, 3000)
};

const state = {
  entries: new Map()
};

function getIpFromRequest(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || 'unknown';
}

function getUserKey(req) {
  if (req.user?.id) {
    return `guest:${req.user.id}`;
  }
  return `ip:${getIpFromRequest(req)}`;
}

function getOrCreateEntry(userKey, now) {
  const existing = state.entries.get(userKey);
  if (existing) {
    existing.lastSeenAt = now;
    return existing;
  }

  const created = {
    strikes: 0,
    lockedUntil: null,
    lastOutOfDomainAt: null,
    lastSeenAt: now
  };
  state.entries.set(userKey, created);
  return created;
}

function cleanup(now) {
  if (state.entries.size <= config.maxEntries) {
    return;
  }

  const items = Array.from(state.entries.entries())
    .sort((a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0));

  const removable = Math.max(0, items.length - config.maxEntries);
  for (let i = 0; i < removable; i += 1) {
    state.entries.delete(items[i][0]);
  }

  for (const [key, value] of state.entries.entries()) {
    if (value.lockedUntil && now > value.lockedUntil + config.decayMs) {
      state.entries.delete(key);
    }
  }
}

function decayStrikes(entry, now) {
  if (!entry.lastOutOfDomainAt) {
    return;
  }

  if (now - entry.lastOutOfDomainAt >= config.decayMs) {
    entry.strikes = 0;
    entry.lastOutOfDomainAt = null;
  }
}

function getReminderByStrikes(strikes) {
  if (strikes < config.warnThreshold) {
    return 'Mogu da pomognem oko boravka u Nastavnoj bazi Goc: smestaj, rezervacije, aktivnosti i dolazak.';
  }

  if (strikes < config.strictThreshold) {
    return 'Molim Vas, tu sam da pomognem oko boravka u Nastavnoj bazi Goc. Pitajte slobodno nesto vezano za smestaj, rezervaciju ili obilazak.';
  }

  return 'I dalje sam tu za pitanja vezana za Nastavnu bazu Goc. Ako zelite, mogu odmah da pomognem oko rezervacije smestaja ili predloga obilaska.';
}

function getLockMessage(until) {
  const untilDate = new Date(until);
  const hh = String(untilDate.getHours()).padStart(2, '0');
  const mm = String(untilDate.getMinutes()).padStart(2, '0');
  return `Chat je privremeno pauziran do ${hh}:${mm} zbog vise uzastopnih poruka van teme. Posle toga rado nastavljamo oko boravka u Nastavnoj bazi Goc.`;
}

function checkLock(req) {
  if (!config.enabled) {
    return { locked: false };
  }

  const now = Date.now();
  cleanup(now);

  const userKey = getUserKey(req);
  const entry = getOrCreateEntry(userKey, now);
  decayStrikes(entry, now);

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      locked: true,
      lockUntil: entry.lockedUntil,
      message: getLockMessage(entry.lockedUntil),
      strikes: entry.strikes
    };
  }

  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.lockedUntil = null;
    entry.strikes = Math.max(0, entry.strikes - 2);
  }

  return {
    locked: false,
    strikes: entry.strikes
  };
}

function registerOutOfDomain(req) {
  if (!config.enabled) {
    return {
      locked: false,
      strikes: 0,
      message: getReminderByStrikes(0)
    };
  }

  const now = Date.now();
  cleanup(now);

  const userKey = getUserKey(req);
  const entry = getOrCreateEntry(userKey, now);
  decayStrikes(entry, now);

  entry.strikes += 1;
  entry.lastOutOfDomainAt = now;

  if (entry.strikes >= config.lockThreshold) {
    entry.lockedUntil = now + config.lockMs;
    return {
      locked: true,
      strikes: entry.strikes,
      lockUntil: entry.lockedUntil,
      message: getLockMessage(entry.lockedUntil)
    };
  }

  return {
    locked: false,
    strikes: entry.strikes,
    message: getReminderByStrikes(entry.strikes)
  };
}

function registerInDomain(req) {
  if (!config.enabled) {
    return;
  }

  const now = Date.now();
  const userKey = getUserKey(req);
  const entry = getOrCreateEntry(userKey, now);
  decayStrikes(entry, now);

  if (entry.strikes > 0) {
    entry.strikes = Math.max(0, entry.strikes - 1);
  }
}

module.exports = {
  checkLock,
  registerOutOfDomain,
  registerInDomain
};