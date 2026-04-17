const http = require('http');

const options = {
  host: '127.0.0.1',
  port: 3000,
  path: '/api/admin/login',
  method: 'OPTIONS',
  headers: {
    Origin: 'http://localhost:5174',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  }
};

const req = http.request(options, (res) => {
  console.log('status', res.statusCode);
  console.log('headers', res.headers);
  res.on('data', () => {});
  res.on('end', () => process.exit(0));
});

req.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

req.end();