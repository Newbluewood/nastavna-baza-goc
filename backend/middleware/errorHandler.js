const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: errors.join(', ') });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  // Default error
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Server error' : err.message;

  res.status(status).json({ error: message });
};

module.exports = errorHandler;