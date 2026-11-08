const cacheService = require('../../services/cacheService');
const invalidatePublicCacheOnWrite = require('../../middleware/invalidatePublicCache');

describe('invalidatePublicCacheOnWrite', () => {
  beforeEach(() => {
    cacheService.clear();
    cacheService.set('__express__/api/home', { ok: true }, 60_000);
  });

  function mockRes(statusCode) {
    const listeners = {};
    return {
      statusCode,
      on(event, fn) {
        listeners[event] = fn;
      },
      finish() {
        listeners.finish?.();
      },
    };
  }

  test('clears cache after successful mutating response', () => {
    const req = { method: 'PUT' };
    const res = mockRes(200);
    const next = jest.fn();

    invalidatePublicCacheOnWrite(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(cacheService.get('__express__/api/home')).toEqual({ ok: true });

    res.finish();
    expect(cacheService.get('__express__/api/home')).toBeNull();
  });

  test('does not clear cache on GET', () => {
    const req = { method: 'GET' };
    const res = mockRes(200);
    const next = jest.fn();

    invalidatePublicCacheOnWrite(req, res, next);
    res.finish?.();
    expect(cacheService.get('__express__/api/home')).toEqual({ ok: true });
  });

  test('does not clear cache on failed mutating response', () => {
    const req = { method: 'POST' };
    const res = mockRes(400);
    const next = jest.fn();

    invalidatePublicCacheOnWrite(req, res, next);
    res.finish();
    expect(cacheService.get('__express__/api/home')).toEqual({ ok: true });
  });
});
