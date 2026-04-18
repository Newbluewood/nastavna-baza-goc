const jwt = require('jsonwebtoken');

const createAuthMiddleware = (secret, errorMsg) => (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: errorMsg.missingHeader });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: errorMsg.missingToken });

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ error: errorMsg.invalidToken });
    req.user = user;
    next();
  });
};

const adminAuthMiddleware = createAuthMiddleware(
  process.env.JWT_SECRET || 'baza_goc_super_secret_key_123',
  {
    missingHeader: "Missing authorization header",
    missingToken: "Missing token",
    invalidToken: "Invalid token"
  }
);

const guestAuthMiddleware = createAuthMiddleware(
  process.env.GUEST_JWT_SECRET || 'guest_secret_change_in_production',
  {
    missingHeader: 'Nije prijavljen.',
    missingToken: 'Token nije pronađen.',
    invalidToken: 'Nevažeći token. Prijavite se ponovo.'
  }
);

const optionalGuestAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token nije pronađen.' });
  }

  jwt.verify(token, process.env.GUEST_JWT_SECRET || 'guest_secret_change_in_production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Nevažeći token. Prijavite se ponovo.' });
    }
    req.user = user;
    next();
  });
};

const signGuestToken = (guest) => {
  return jwt.sign(
    { id: guest.id, email: guest.email, name: guest.name },
    process.env.GUEST_JWT_SECRET || 'guest_secret_change_in_production',
    { expiresIn: '30d' }
  );
};

module.exports = {
  adminAuthMiddleware,
  guestAuthMiddleware,
  optionalGuestAuthMiddleware,
  signGuestToken
};