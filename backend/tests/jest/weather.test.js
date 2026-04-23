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
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('days', 7);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.summary)).toBe(true);
  });

  it('GET /weather/forecast?days=3 returns 3-day forecast', async () => {
    const res = await request(app).get('/weather/forecast?days=3');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('days', 3);
    expect(Array.isArray(res.body.summary)).toBe(true);
  });
});
