const jwt = require('jsonwebtoken');

const GUEST_JWT_SECRET = process.env.GUEST_JWT_SECRET || 'guest_secret_change_in_production';

const guestAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Nije prijavljen.' });
  
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token nije pronađen.' });

  try {
    const decoded = jwt.verify(token, GUEST_JWT_SECRET);
    req.guest = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Nevažeći token. Prijavite se ponovo.' });
  }
};

const signGuestToken = (guest) => {
  return jwt.sign(
    { id: guest.id, email: guest.email, name: guest.name },
    GUEST_JWT_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = { guestAuthMiddleware, signGuestToken };
