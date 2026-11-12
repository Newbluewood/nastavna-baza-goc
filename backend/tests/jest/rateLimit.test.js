const { createRateLimit } = require('../../middleware/rateLimit');

function mockReq(overrides = {}) {
  return {
    ip: '203.0.113.10',
    headers: {},
    user: null,
    ...overrides,
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('createRateLimit', () => {
  test('allows requests under the max, then returns 429', () => {
    const limit = createRateLimit({
      name: 'test_login',
      enabled: true,
      windowMs: 60_000,
      max: 3,
      message: 'too many',
    });

    const next = jest.fn();
    for (let i = 0; i < 3; i += 1) {
      const res = mockRes();
      limit(mockReq(), res, next);
      expect(res.statusCode).toBe(200);
    }
    expect(next).toHaveBeenCalledTimes(3);

    const blocked = mockRes();
    const nextBlocked = jest.fn();
    limit(mockReq(), blocked, nextBlocked);
    expect(nextBlocked).not.toHaveBeenCalled();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toEqual({ error: 'too many' });
    expect(blocked.headers['Retry-After']).toBeTruthy();
  });

  test('tracks guests separately from anonymous IPs', () => {
    const limit = createRateLimit({
      name: 'test_guest',
      enabled: true,
      max: 1,
      windowMs: 60_000,
    });

    const next = jest.fn();
    limit(mockReq({ user: { id: 7 } }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    const blockedGuest = mockRes();
    const nextGuest = jest.fn();
    limit(mockReq({ user: { id: 7 } }), blockedGuest, nextGuest);
    expect(nextGuest).not.toHaveBeenCalled();
    expect(blockedGuest.statusCode).toBe(429);

    const nextAnon = jest.fn();
    limit(mockReq({ ip: '203.0.113.99' }), mockRes(), nextAnon);
    expect(nextAnon).toHaveBeenCalledTimes(1);
  });

  test('can be disabled', () => {
    const limit = createRateLimit({
      name: 'test_off',
      enabled: false,
      max: 1,
    });
    const next = jest.fn();
    limit(mockReq(), mockRes(), next);
    limit(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
