const request = require('supertest');
const express = require('express');
const publicRoutes = require('../../routes/public');
const { getMysqlPoolOptions } = require('../../lib/mysqlConnectionOptions');

describe('GET /health', () => {
  it('returns ok when DB probe succeeds', async () => {
    const app = express();
    app.locals.db = {
      query: async () => [[{ ok: 1 }]],
    };
    app.use(publicRoutes);

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, db: true });
    expect(typeof res.body.ts).toBe('string');
  });

  it('returns 503 when DB probe hangs past HEALTH_DB_TIMEOUT_MS', async () => {
    process.env.HEALTH_DB_TIMEOUT_MS = '50';
    const app = express();
    app.locals.db = {
      query: () => new Promise(() => {}),
    };
    app.use(publicRoutes);

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      ok: false,
      db: false,
      error: 'Database timeout',
    });
  });
});

describe('getMysqlPoolOptions', () => {
  it('includes connectTimeout so pool acquisition cannot hang forever', () => {
    const opts = getMysqlPoolOptions();
    expect(opts.connectTimeout).toBeGreaterThan(0);
    expect(opts.enableKeepAlive).toBe(true);
  });
});
