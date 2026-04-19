function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  enabled: String(process.env.AI_CHAT_CONTEXT_GUARD_ENABLED || 'true').toLowerCase() === 'true',
  warnThreshold: toPositiveInt(process.env.AI_CHAT_OOD_WARN_THRESHOLD, 5),
  reminderThreshold: toPositiveInt(process.env.AI_CHAT_OOD_REMINDER_THRESHOLD, 10),
  decayMs: toPositiveInt(process.env.AI_CHAT_OOD_DECAY_MS, 1_800_000),
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
    lastOutOfDomainAt: null,
    lastSeenAt: now
  };
  state.entries.set(userKey, created);
  return created;
}

function cleanup(now) {
  if (state.entries.size <= config.maxEntries) return;

  const items = Array.from(state.entries.entries())
    .sort((a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0));

  const removable = Math.max(0, items.length - config.maxEntries);
  for (let i = 0; i < removable; i += 1) {
    state.entries.delete(items[i][0]);
  }
}

function decayStrikes(entry, now) {
  if (!entry.lastOutOfDomainAt) return;
  if (now - entry.lastOutOfDomainAt >= config.decayMs) {
    entry.strikes = 0;
    entry.lastOutOfDomainAt = null;
  }
}

function getReminderByStrikes(strikes) {
  if (strikes < config.warnThreshold) return null;

  if (strikes < config.reminderThreshold) {
    return 'Могу да помогнем око боравка у Наставној бази Гоч: смештај, активности, ресторан и долазак.';
  }

  return 'Ту сам за питања везана за Наставну базу Гоч — смештај, резервације, обилазак и ресторан.';
}

/**
 * Unified guard check — called by chatController.
 * Tracks OOD strikes for metrics, returns optional reminder.
 * NO lockout — user is never blocked for OOD messages.
 */
function check(req, safetyClass) {
  if (!config.enabled) {
    return { reminder: null, strikes: 0 };
  }

  const now = Date.now();
  cleanup(now);

  const userKey = getUserKey(req);
  const entry = getOrCreateEntry(userKey, now);
  decayStrikes(entry, now);

  if (safetyClass === 'out_of_domain') {
    entry.strikes += 1;
    entry.lastOutOfDomainAt = now;
  } else if (safetyClass === 'in_domain' && entry.strikes > 0) {
    entry.strikes = Math.max(0, entry.strikes - 1);
  }

  return {
    reminder: getReminderByStrikes(entry.strikes),
    strikes: entry.strikes
  };
}

module.exports = {
  check
};
