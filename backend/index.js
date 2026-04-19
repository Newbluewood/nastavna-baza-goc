require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const errorHandler = require('./middleware/errorHandler');

console.log('Starting server...');

// Routes
const publicRoutes = require('./routes/public');
console.log('Public routes required:', typeof publicRoutes);
console.log('Public routes is function:', typeof publicRoutes === 'function');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const guestRoutes = require('./routes/guest');
const cancelRoutes = require('./routes/cancel');
const aiRoutes = require('./routes/ai');
const chatRoutes = require('./routes/chat');

const app = express();

console.log('Express app created');

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log('Blocked CORS origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  next();
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
      res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type,Authorization');
    }
    return res.sendStatus(204);
  }
  next();
});

console.log('CORS configured');

app.use(express.json());

console.log('JSON middleware added');

// Make db available to routes
app.locals.db = db;

console.log('DB attached to app');

// Add middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Routes
app.use('/api', publicRoutes);
console.log('Public routes mounted on /api');
console.log('Available routes:');
publicRoutes.stack.forEach((layer, index) => {
  if (layer.route) {
    console.log(`  ${index}: ${Object.keys(layer.route.methods).join(',')} ${layer.route.path}`);
  }
});

app.use('/api/admin', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/cancel', cancelRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/api/test`);
  console.log(`Test URL: http://127.0.0.1:${PORT}/api/test`);
});