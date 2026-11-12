const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { adminLogin } = require('../../controllers/authController');

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

describe('adminLogin role in JWT', () => {
  test('returns role from admins row and embeds it in the token', async () => {
    const passwordHash = await bcrypt.hash('secret12', 10);
    const req = {
      validated: { username: 'editor1', password: 'secret12' },
      app: {
        locals: {
          db: {
            query: jest.fn().mockResolvedValue([
              [{ id: 9, username: 'editor1', password_hash: passwordHash, role: 'editor' }],
            ]),
          },
        },
      },
    };
    const res = mockRes();

    await adminLogin(req, res);

    expect(res.body.admin).toEqual({ id: 9, username: 'editor1', role: 'editor' });
    expect(res.body.token).toBeTruthy();

    const payload = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET || 'baza_goc_super_secret_key_123'
    );
    expect(payload.role).toBe('editor');
    expect(payload.username).toBe('editor1');
  });

  test('defaults missing DB role to admin', async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const req = {
      validated: { username: 'admin', password: 'admin123' },
      app: {
        locals: {
          db: {
            query: jest.fn().mockResolvedValue([
              [{ id: 1, username: 'admin', password_hash: passwordHash }],
            ]),
          },
        },
      },
    };
    const res = mockRes();

    await adminLogin(req, res);

    expect(res.body.admin.role).toBe('admin');
    const payload = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET || 'baza_goc_super_secret_key_123'
    );
    expect(payload.role).toBe('admin');
  });
});
