const {
  canAccess,
  normalizeRole,
  ROLES,
  modulesForRole,
} = require('../../auth/permissions');
const { requirePermission } = require('../../middleware/auth');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
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

describe('CMS RBAC permissions map', () => {
  test('admin can access settings, cms_users, and guests', () => {
    expect(canAccess(ROLES.ADMIN, 'settings')).toBe(true);
    expect(canAccess(ROLES.ADMIN, 'cms_users')).toBe(true);
    expect(canAccess(ROLES.ADMIN, 'guests')).toBe(true);
  });

  test('editor can edit news but not settings or guests', () => {
    expect(canAccess(ROLES.EDITOR, 'news')).toBe(true);
    expect(canAccess(ROLES.EDITOR, 'content_ai')).toBe(true);
    expect(canAccess(ROLES.EDITOR, 'settings')).toBe(false);
    expect(canAccess(ROLES.EDITOR, 'guests')).toBe(false);
    expect(canAccess(ROLES.EDITOR, 'system')).toBe(false);
  });

  test('reception can access guests/inquiries but not news write modules', () => {
    expect(canAccess(ROLES.RECEPTION, 'guests')).toBe(true);
    expect(canAccess(ROLES.RECEPTION, 'inquiries')).toBe(true);
    expect(canAccess(ROLES.RECEPTION, 'rooms')).toBe(true);
    expect(canAccess(ROLES.RECEPTION, 'news')).toBe(false);
    expect(canAccess(ROLES.RECEPTION, 'settings')).toBe(false);
  });

  test('normalizeRole rejects unknown values', () => {
    expect(normalizeRole('editor')).toBe('editor');
    expect(normalizeRole('nope')).toBeNull();
  });

  test('modulesForRole returns a copy for reception', () => {
    const modules = modulesForRole(ROLES.RECEPTION);
    expect(modules).toEqual(expect.arrayContaining(['guests', 'inquiries', 'rooms', 'room_map']));
    expect(modules).not.toEqual(expect.arrayContaining(['news', 'settings']));
  });
});

describe('requirePermission middleware', () => {
  test('editor gets 403 on settings', () => {
    const mw = requirePermission('settings');
    const req = { user: { id: 2, username: 'ed', role: 'editor' } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/dozvolu/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('reception can pass guests guard', () => {
    const mw = requirePermission('guests');
    const req = { user: { id: 3, username: 'rec', role: 'reception' } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('reception gets 403 on news', () => {
    const mw = requirePermission('news');
    const req = { user: { id: 3, username: 'rec', role: 'reception' } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('legacy token without role is treated as admin', () => {
    const mw = requirePermission('system');
    const req = { user: { id: 1, username: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
  });
});
