require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const errorHandler = require('./middleware/errorHandler');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const guestRoutes = require('./routes/guest');
const cancelRoutes = require('./routes/cancel');
const aiRoutes = require('./routes/ai');
const chatRoutes = require('./routes/chat');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/themes', express.static(path.join(__dirname, 'public/themes')));

app.locals.db = db;

app.use('/api', publicRoutes);
app.use('/api/admin', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/cancel', cancelRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);

app.use(errorHandler);

module.exports = app;
