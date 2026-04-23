// Jest-compatible async test for /api/home endpoint
const http = require('http');

describe('GET /api/home (server running)', () => {
  it('should return 200 and valid JSON', (done) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/home',
      method: 'GET'
    };
    const req = http.request(options, (res) => {
      expect(res.statusCode).toBe(200);
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          expect(json).toHaveProperty('news');
          expect(json).toHaveProperty('facilities');
          done();
        } catch (e) {
          done(e);
        }
      });
    });
    req.on('error', (e) => done(e));
    req.end();
  });
});
