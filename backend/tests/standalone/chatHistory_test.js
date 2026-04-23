// Standalone test for Chat History API
const http = require('http');
const db = require('./db');
const bcrypt = require('bcryptjs');

async function getTestToken() {
  const email = 'testuser@example.com';
  const password = 'testpass123';
  const passwordHash = await bcrypt.hash(password, 10);
  await db.query('INSERT INTO guests (email, password_hash, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), name=VALUES(name)', [email, passwordHash, 'Test User']);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 3000, path: '/api/guests/login', method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ email, password }));
    req.end();
  });
}

(async () => {
  try {
    const token = await getTestToken();
    // Save chat message
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: 3000, path: '/api/chat/history', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✔ Chat message saved');
            resolve();
          } else {
            console.log('❗ Failed to save chat message:', res.statusCode, body);
            reject();
          }
        });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ role: 'user', message: 'Hello from test', session_id: 'testsession' }));
      req.end();
    });
    // Retrieve chat history
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: 3000, path: '/api/chat/history?session_id=testsession', method: 'GET', headers: { Authorization: `Bearer ${token}` }
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 && body.includes('Hello from test')) {
            console.log('✔ Chat history retrieved');
            resolve();
          } else {
            console.log('❗ Failed to retrieve chat history:', res.statusCode, body);
            reject();
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
    // Reject missing fields
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: 3000, path: '/api/chat/history', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      }, res => {
        if (res.statusCode === 400) {
          console.log('✔ Rejected missing fields');
          resolve();
        } else {
          console.log('❗ Did not reject missing fields:', res.statusCode);
          reject();
        }
      });
      req.on('error', reject);
      req.write(JSON.stringify({ message: 'Missing role' }));
      req.end();
    });
    // Reject unauthenticated GET
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: 3000, path: '/api/chat/history', method: 'GET' }, res => {
        if (res.statusCode === 401) {
          console.log('✔ Rejected unauthenticated GET');
          resolve();
        } else {
          console.log('❗ Did not reject unauthenticated GET:', res.statusCode);
          reject();
        }
      });
      req.on('error', reject);
      req.end();
    });
  } catch (e) {
    console.error('❗ Test error:', e);
  }
})();
