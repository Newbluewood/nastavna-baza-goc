/**
 * Thin logger — levels without pulling winston yet.
 * Set LOG_LEVEL=debug|info|warn|error (default: info in production, debug otherwise).
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveLevel() {
  const raw = String(process.env.LOG_LEVEL || '').toLowerCase();
  if (LEVELS[raw]) return raw;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[resolveLevel()];
}

function stamp(level, args) {
  const prefix = `[${level.toUpperCase()}]`;
  return [prefix, ...args];
}

const logger = {
  debug: (...args) => {
    if (shouldLog('debug')) console.debug(...stamp('debug', args));
  },
  info: (...args) => {
    if (shouldLog('info')) console.info(...stamp('info', args));
  },
  warn: (...args) => {
    if (shouldLog('warn')) console.warn(...stamp('warn', args));
  },
  error: (...args) => {
    if (shouldLog('error')) console.error(...stamp('error', args));
  },
};

module.exports = logger;
