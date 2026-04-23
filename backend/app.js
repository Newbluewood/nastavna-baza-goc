const express = require('express');
const { requestLogger } = require('./logger');

const app = express();

// Request logging middleware
function logRequests(req, res, next) {
  requestLogger.info({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    body: req.body
  });
  next();
}

app.use(logRequests);

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});