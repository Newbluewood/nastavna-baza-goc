const cache = new Map();

// Standard TTL 5 minutes for public API endpoints
const DEFAULT_TTL = 5 * 60 * 1000;

function set(key, value, ttl = DEFAULT_TTL) {
  const expiresAt = Date.now() + ttl;
  cache.set(key, { value, expiresAt });
}

function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function clear() {
  cache.clear();
}

function del(key) {
  cache.delete(key);
}

module.exports = {
  set,
  get,
  clear,
  del
};
