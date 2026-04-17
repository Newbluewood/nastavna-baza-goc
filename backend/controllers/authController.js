const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

async function adminLogin(req, res) {
  const { username, password } = req.validated;
  const db = req.app.locals.db;

  const [admins] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
  if (admins.length === 0) {
    return sendError(res, 401, 'Invalid credentials');
  }

  const admin = admins[0];
  const isValidPassword = await bcrypt.compare(password, admin.password_hash);
  if (!isValidPassword) {
    return sendError(res, 401, 'Invalid credentials');
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || 'baza_goc_super_secret_key_123',
    { expiresIn: '8h' }
  );

  res.json({ token, admin: { id: admin.id, username: admin.username } });
}

async function translate(req, res) {
  const { text, target_lang } = req.body || {};

  if (!text || typeof text !== 'string') {
    return sendError(res, 400, 'Text is required');
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey || apiKey === 'your_deepl_api_key_here') {
    return res.json({ translated_text: `[EN: ${text}]` });
  }

  const deeplUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const deeplRes = await fetch(deeplUrl, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: (target_lang || 'EN').toUpperCase()
    })
  });

  const data = await deeplRes.json();
  if (!deeplRes.ok) {
    console.error('DeepL error:', data);
    return sendError(res, 502, 'Translation service failed');
  }

  return res.json({ translated_text: data?.translations?.[0]?.text || '' });
}

module.exports = { adminLogin, translate };
