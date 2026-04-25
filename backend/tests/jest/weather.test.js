const request = require('supertest');
const express = require('express');
const publicRoutes = require('../../routes/public');

describe('Weather API', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(publicRoutes);
  });

  it('GET /weather/forecast returns 7-day forecast', async () => {
    const res = await request(app).get('/weather/forecast');
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(res.body).toHaveProperty('error');
      return;
    }
    expect(res.body).toHaveProperty('days', 7);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('data');
    expect(typeof res.body.summary).toBe('string');
  });

  it('GET /weather/forecast?days=3 returns 3-day forecast', async () => {
    const res = await request(app).get('/weather/forecast?days=3');
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(res.body).toHaveProperty('error');
      return;
    }
    expect(res.body).toHaveProperty('days', 3);
    expect(typeof res.body.summary).toBe('string');
  });
});
