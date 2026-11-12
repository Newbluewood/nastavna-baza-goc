const scheduleKnowledgeIngest = require('../scheduleKnowledgeIngest');
const { isKnowledgeContentWrite } = require('../scheduleKnowledgeIngest');

jest.mock('../../services/knowledgeIngestNotify', () => ({
  notifyKnowledgeIngest: jest.fn(() => Promise.resolve({ ok: true })),
}));

const { notifyKnowledgeIngest } = require('../../services/knowledgeIngestNotify');

describe('scheduleKnowledgeIngest', () => {
  beforeEach(() => {
    notifyKnowledgeIngest.mockClear();
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

  test('notifies after a successful theme save', () => {
    const req = { method: 'POST', path: '/themes' };
    const res = mockRes(201);
    const next = jest.fn();

    scheduleKnowledgeIngest(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(notifyKnowledgeIngest).not.toHaveBeenCalled();

    res.finish();
    expect(notifyKnowledgeIngest).toHaveBeenCalledWith('/themes');
  });

  test('does not notify on GET or failed save', () => {
    const getRes = mockRes(200);
    scheduleKnowledgeIngest({ method: 'GET', path: '/news' }, getRes, jest.fn());
    getRes.finish();

    const failRes = mockRes(400);
    scheduleKnowledgeIngest({ method: 'PUT', path: '/news/4' }, failRes, jest.fn());
    failRes.finish();

    expect(notifyKnowledgeIngest).not.toHaveBeenCalled();
  });

  test('ignores admin writes that are not in the knowledge ingest', () => {
    expect(isKnowledgeContentWrite({ method: 'POST', path: '/inquiries/3/status' })).toBe(false);
    expect(isKnowledgeContentWrite({ method: 'PUT', path: '/settings' })).toBe(false);
    expect(isKnowledgeContentWrite({ method: 'PUT', path: '/nav/2' })).toBe(false);
    expect(isKnowledgeContentWrite({ method: 'POST', path: '/guests/1/vouchers' })).toBe(false);
    expect(isKnowledgeContentWrite({ method: 'GET', path: '/room-map' })).toBe(false);
    expect(isKnowledgeContentWrite({ method: 'PUT', path: '/rooms/9', baseUrl: '/api/admin' })).toBe(true);
    expect(isKnowledgeContentWrite({ method: 'DELETE', path: '/menu-items/2' })).toBe(true);
  });
});
