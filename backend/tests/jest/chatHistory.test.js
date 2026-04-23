
const request = require('supertest');
const app = require('../../index');
const db = require('../../db');
const bcrypt = require('bcryptjs');

async function databaseExists() {
  try {
    // Try to select from information_schema.schemata
    const [rows] = await db.query('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [process.env.DB_NAME || 'defaultdb']);
    return rows.length > 0;
  } catch (e) {
    return false;
  }
}

async function getTestToken() {
  const email = 'testuser@example.com';
  const password = 'testpass123';
  const passwordHash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO guests (email, password_hash, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), name=VALUES(name)', [email, passwordHash, 'Test User']);
  const res = await request(app)
    .post('/api/guests/login')
    .send({ email, password });
  return res.body.token;
}

describe('Chat History API', () => {
  let token;
  let dbReady = false;

  beforeAll(async () => {
    dbReady = await databaseExists();
    if (dbReady) {
      token = await getTestToken();
    }
  });

  const maybeIt = (desc, fn) => dbReady ? it(desc, fn) : it.skip(desc, fn);

  maybeIt('should save a chat message (user)', async () => {
    const res = await request(app)
      .post('/api/chat/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'user', message: 'Hello from test', session_id: 'testsession' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.role).toBe('user');
  });

  maybeIt('should retrieve chat history (user)', async () => {
    const res = await request(app)
      .get('/api/chat/history?session_id=testsession')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(m => m.message === 'Hello from test')).toBe(true);
  });

  maybeIt('should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/chat/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Missing role' });
    expect(res.statusCode).toBe(400);
  });

  maybeIt('should reject unauthenticated GET', async () => {
    const res = await request(app)
      .get('/api/chat/history');
    expect(res.statusCode).toBe(401);
  });
});
