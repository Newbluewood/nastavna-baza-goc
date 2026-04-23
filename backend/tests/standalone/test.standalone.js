// Standalone server connectivity test (run with: node backend/test.standalone.js)
const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/home',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Body:', body);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
