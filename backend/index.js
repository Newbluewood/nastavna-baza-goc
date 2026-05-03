require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const logger = require('./logger');
const errorHandler = require('./middleware/errorHandler');

// ── Routes ──────────────────────────────────────────────────────────────────
const publicRoutes = require('./routes/public');
const authRoutes   = require('./routes/auth');
const adminRoutes  = require('./routes/admin');
const guestRoutes  = require('./routes/guest');
const cancelRoutes = require('./routes/cancel');
const aiRoutes     = require('./routes/ai');
const chatRoutes   = require('./routes/chat');

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();

// CORS — single source of truth via the `cors` package.
// Manual header duplication removed: cors() handles preflight and credentials.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/images',  express.static(path.join(__dirname, 'public/images')));

// Attach db pool to app locals so route handlers can access it via req.app.locals.db
app.locals.db = db;

// Request logger — brief one-liner per request
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ── Route mounting ───────────────────────────────────────────────────────────
app.use('/api',        publicRoutes);
app.use('/api/admin',  authRoutes);
app.use('/api/admin',  adminRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/cancel', cancelRoutes);
app.use('/api/ai',     aiRoutes);
app.use('/api/chat',   chatRoutes);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;