const { sendError } = require('../../utils/response');

// --- PROJECTS ---

async function getProjects(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM projects ORDER BY id DESC');
  res.json(rows);
}

async function createProject(req, res) {
  const db = req.app.locals.db;
  const { title, description, status, start_date } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'INSERT INTO projects (title, description, status, start_date) VALUES (?, ?, ?, ?)',
    [title, description || null, status || 'активан', start_date || null]
  );
  res.json({ message: 'Project created', projectId: result.insertId });
}

async function updateProject(req, res) {
  const db = req.app.locals.db;
  const { title, description, status, start_date } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'UPDATE projects SET title = ?, description = ?, status = ?, start_date = ? WHERE id = ?',
    [title, description || null, status || 'активан', start_date || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Project not found');
  res.json({ message: 'Project updated' });
}

async function deleteProject(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Project not found');
  res.json({ message: 'Project deleted' });
}

// --- STAFF ---

async function getStaff(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM staff ORDER BY id ASC');
  res.json(rows);
}

async function createStaffMember(req, res) {
  const db = req.app.locals.db;
  const { full_name, role, contact_email, photo_url } = req.body;
  if (!full_name) return sendError(res, 400, 'Full name is required');

  const [result] = await db.query(
    'INSERT INTO staff (full_name, role, contact_email, photo_url) VALUES (?, ?, ?, ?)',
    [full_name, role || null, contact_email || null, photo_url || null]
  );
  res.json({ message: 'Staff member created', staffId: result.insertId });
}

async function updateStaffMember(req, res) {
  const db = req.app.locals.db;
  const { full_name, role, contact_email, photo_url } = req.body;
  if (!full_name) return sendError(res, 400, 'Full name is required');

  const [result] = await db.query(
    'UPDATE staff SET full_name = ?, role = ?, contact_email = ?, photo_url = ? WHERE id = ?',
    [full_name, role || null, contact_email || null, photo_url || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Staff member not found');
  res.json({ message: 'Staff member updated' });
}

async function deleteStaffMember(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Staff member not found');
  res.json({ message: 'Staff member deleted' });
}

// --- PAGES ---

async function getPages(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM pages ORDER BY id ASC');
  res.json(rows);
}

async function getPageById(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM pages WHERE id = ?', [req.params.id]);
  if (!rows.length) return sendError(res, 404, 'Page not found');
  res.json(rows[0]);
}

async function createPage(req, res) {
  const db = req.app.locals.db;
  const { slug, title, content } = req.body;
  if (!slug || !title) return sendError(res, 400, 'Slug and title are required');

  const [existing] = await db.query('SELECT id FROM pages WHERE slug = ?', [slug]);
  if (existing.length) return sendError(res, 409, 'Page with this slug already exists');

  const [result] = await db.query(
    'INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)',
    [slug, title, content || null]
  );
  res.json({ message: 'Page created', pageId: result.insertId });
}

async function updatePage(req, res) {
  const db = req.app.locals.db;
  const { title, content } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'UPDATE pages SET title = ?, content = ? WHERE id = ?',
    [title, content || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Page not found');
  res.json({ message: 'Page updated' });
}

async function deletePage(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM pages WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Page not found');
  res.json({ message: 'Page deleted' });
}

// --- FACILITIES & ROOMS ---

async function getFacilities(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT id, name, type FROM facilities ORDER BY id ASC');
  res.json(rows);
}

async function getRoomsByFacility(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM rooms WHERE facility_id = ? ORDER BY id ASC', [req.params.id]);
  res.json(rows);
}

async function updateRoom(req, res) {
  const db = req.app.locals.db;
  const { name, capacity, price_base, price_half_board, price_full_board, meal_info } = req.body;
  if (!name) return sendError(res, 400, 'Name is required');

  const [result] = await db.query(
    `UPDATE rooms SET 
      name = ?, 
      capacity = ?, 
      price_base = ?, 
      price_half_board = ?, 
      price_full_board = ?, 
      meal_info = ? 
    WHERE id = ?`,
    [name, capacity || null, price_base || 0, price_half_board || 0, price_full_board || 0, meal_info || null, req.params.id]
  );

  if (result.affectedRows === 0) return sendError(res, 404, 'Room not found');
  res.json({ message: 'Room updated' });
}


module.exports = {
  getProjects, createProject, updateProject, deleteProject,
  getStaff, createStaffMember, updateStaffMember, deleteStaffMember,
  getPages, getPageById, createPage, updatePage, deletePage,
  getFacilities, getRoomsByFacility, updateRoom
};
