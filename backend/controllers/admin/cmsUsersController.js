const bcrypt = require('bcryptjs');
const { sendError } = require('../../utils/response');
const { ROLE_LIST, normalizeRole, ROLES } = require('../../auth/permissions');

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role) || ROLES.ADMIN,
    created_at: row.created_at,
  };
}

async function listCmsUsers(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(
    'SELECT id, username, role, created_at FROM admins ORDER BY created_at ASC, id ASC'
  );
  res.json(rows.map(publicUser));
}

async function createCmsUser(req, res) {
  const db = req.app.locals.db;
  const { username, password, role } = req.validated;
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return sendError(res, 400, `Uloga mora biti jedna od: ${ROLE_LIST.join(', ')}`);
  }

  const [existing] = await db.query('SELECT id FROM admins WHERE username = ? LIMIT 1', [
    username.trim(),
  ]);
  if (existing.length > 0) {
    return sendError(res, 409, 'Korisničko ime već postoji');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO admins (username, password_hash, role, created_at) VALUES (?, ?, ?, NOW())',
    [username.trim(), passwordHash, normalizedRole]
  );

  res.status(201).json({
    id: result.insertId,
    username: username.trim(),
    role: normalizedRole,
  });
}

async function updateCmsUser(req, res) {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 400, 'Neispravan ID');
  }

  const [rows] = await db.query(
    'SELECT id, username, role, created_at FROM admins WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) {
    return sendError(res, 404, 'Korisnik nije pronađen');
  }

  const current = rows[0];
  const { username, password, role } = req.validated || {};
  const updates = [];
  const params = [];

  if (username !== undefined) {
    const nextUsername = String(username).trim();
    if (nextUsername.length < 3) {
      return sendError(res, 400, 'Korisničko ime je prekratko');
    }
    const [clash] = await db.query(
      'SELECT id FROM admins WHERE username = ? AND id <> ? LIMIT 1',
      [nextUsername, id]
    );
    if (clash.length > 0) {
      return sendError(res, 409, 'Korisničko ime već postoji');
    }
    updates.push('username = ?');
    params.push(nextUsername);
  }

  if (role !== undefined) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return sendError(res, 400, `Uloga mora biti jedna od: ${ROLE_LIST.join(', ')}`);
    }
    const currentRole = normalizeRole(current.role) || ROLES.ADMIN;
    if (currentRole === ROLES.ADMIN && normalizedRole !== ROLES.ADMIN) {
      const [adminCount] = await db.query(
        "SELECT COUNT(*) AS c FROM admins WHERE role = 'admin' OR role IS NULL"
      );
      if (Number(adminCount[0].c) <= 1) {
        return sendError(res, 400, 'Ne možete ukloniti poslednjeg admina');
      }
    }
    updates.push('role = ?');
    params.push(normalizedRole);
  }

  if (password !== undefined && password !== null && password !== '') {
    if (String(password).length < 6) {
      return sendError(res, 400, 'Lozinka mora imati najmanje 6 karaktera');
    }
    updates.push('password_hash = ?');
    params.push(await bcrypt.hash(password, 10));
  }

  if (updates.length === 0) {
    return sendError(res, 400, 'Nema izmena');
  }

  params.push(id);
  await db.query(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, params);

  const [fresh] = await db.query(
    'SELECT id, username, role, created_at FROM admins WHERE id = ? LIMIT 1',
    [id]
  );
  res.json(publicUser(fresh[0]));
}

async function deleteCmsUser(req, res) {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 400, 'Neispravan ID');
  }

  if (req.user?.id === id) {
    return sendError(res, 400, 'Ne možete obrisati sopstveni nalog');
  }

  const [rows] = await db.query('SELECT id, role FROM admins WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) {
    return sendError(res, 404, 'Korisnik nije pronađen');
  }

  const targetRole = normalizeRole(rows[0].role) || ROLES.ADMIN;
  if (targetRole === ROLES.ADMIN) {
    const [adminCount] = await db.query(
      "SELECT COUNT(*) AS c FROM admins WHERE role = 'admin' OR role IS NULL"
    );
    if (Number(adminCount[0].c) <= 1) {
      return sendError(res, 400, 'Ne možete obrisati poslednjeg admina');
    }
  }

  await db.query('DELETE FROM admins WHERE id = ?', [id]);
  res.json({ ok: true });
}

module.exports = {
  listCmsUsers,
  createCmsUser,
  updateCmsUser,
  deleteCmsUser,
};
