const { sendError } = require('../../utils/response');

// --- PROJECTS ---

async function getProjects(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT p.*, pt.title as title_en, pt.description as description_en
    FROM projects p
    LEFT JOIN project_translations pt ON p.id = pt.entity_id AND pt.lang = 'en'
    ORDER BY p.id DESC
  `);
  res.json(rows);
}

async function createProject(req, res) {
  const db = req.app.locals.db;
  const { title, description, title_en, description_en, status, start_date } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'INSERT INTO projects (title, description, status, start_date) VALUES (?, ?, ?, ?)',
    [title, description || null, status || 'активан', start_date || null]
  );
  if (title_en || description_en) {
    await db.query(
      'INSERT INTO project_translations (entity_id, lang, title, description) VALUES (?, ?, ?, ?)',
      [result.insertId, 'en', title_en || null, description_en || null]
    );
  }
  res.json({ message: 'Project created', projectId: result.insertId });
}

async function updateProject(req, res) {
  const db = req.app.locals.db;
  const { title, description, title_en, description_en, status, start_date } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'UPDATE projects SET title = ?, description = ?, status = ?, start_date = ? WHERE id = ?',
    [title, description || null, status || 'активан', start_date || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Project not found');

  await db.query(
    'INSERT INTO project_translations (entity_id, lang, title, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)',
    [req.params.id, 'en', title_en || null, description_en || null]
  );
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
  const [rows] = await db.query(`
    SELECT s.*, st.role as role_en
    FROM staff s
    LEFT JOIN staff_translations st ON s.id = st.entity_id AND st.lang = 'en'
    ORDER BY s.id ASC
  `);
  res.json(rows);
}

async function createStaffMember(req, res) {
  const db = req.app.locals.db;
  const { full_name, role, role_en, contact_email, photo_url } = req.body;
  if (!full_name) return sendError(res, 400, 'Full name is required');

  const [result] = await db.query(
    'INSERT INTO staff (full_name, role, contact_email, photo_url) VALUES (?, ?, ?, ?)',
    [full_name, role || null, contact_email || null, photo_url || null]
  );
  if (role_en) {
    await db.query(
      'INSERT INTO staff_translations (entity_id, lang, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)',
      [result.insertId, 'en', role_en]
    );
  }
  res.json({ message: 'Staff member created', staffId: result.insertId });
}

async function updateStaffMember(req, res) {
  const db = req.app.locals.db;
  const { full_name, role, role_en, contact_email, photo_url } = req.body;
  if (!full_name) return sendError(res, 400, 'Full name is required');

  const [result] = await db.query(
    'UPDATE staff SET full_name = ?, role = ?, contact_email = ?, photo_url = ? WHERE id = ?',
    [full_name, role || null, contact_email || null, photo_url || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Staff member not found');

  await db.query(
    'INSERT INTO staff_translations (entity_id, lang, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)',
    [req.params.id, 'en', role_en || null]
  );
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
  const { slug, title, content, hero_image } = req.body;
  if (!slug || !title) return sendError(res, 400, 'Slug and title are required');

  const [existing] = await db.query('SELECT id FROM pages WHERE slug = ?', [slug]);
  if (existing.length) return sendError(res, 409, 'Page with this slug already exists');

  const [result] = await db.query(
    'INSERT INTO pages (slug, title, content, hero_image) VALUES (?, ?, ?, ?)',
    [slug, title, content || null, hero_image || null]
  );
  res.json({ message: 'Page created', pageId: result.insertId });
}

async function updatePage(req, res) {
  const db = req.app.locals.db;
  const { title, content, hero_image } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'UPDATE pages SET title = ?, content = ?, hero_image = ? WHERE id = ?',
    [title, content || null, hero_image || null, req.params.id]
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

// --- SITE SETTINGS ---

async function getSettings(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM site_settings ORDER BY setting_key');
  res.json(rows);
}

async function updateSettings(req, res) {
  const db = req.app.locals.db;
  const { settings } = req.body;
  if (!Array.isArray(settings)) return sendError(res, 400, 'settings must be an array');

  for (const s of settings) {
    if (!s.setting_key) continue;
    await db.query(
      'UPDATE site_settings SET value_sr = ?, value_en = ? WHERE setting_key = ?',
      [s.value_sr || '', s.value_en || '', s.setting_key]
    );
  }
  res.json({ message: 'Settings updated' });
}

// --- HERO SLIDES ---

async function getHeroSlides(req, res) {
  const db = req.app.locals.db;
  const pageSlug = req.query.page_slug;
  if (!pageSlug) return sendError(res, 400, 'page_slug is required');

  const [rows] = await db.query(`
    SELECT hs.*, hst.title as title_en, hst.subtitle as subtitle_en
    FROM hero_slides hs
    LEFT JOIN hero_slides_translations hst ON hs.id = hst.entity_id AND hst.lang = 'en'
    WHERE hs.page_slug = ?
    ORDER BY hs.display_order ASC, hs.id ASC
  `, [pageSlug]);
  res.json(rows);
}

async function createHeroSlide(req, res) {
  const db = req.app.locals.db;
  const { page_slug, title, subtitle, title_en, subtitle_en, image_url, target_link, display_order } = req.body;
  if (!page_slug || !image_url) return sendError(res, 400, 'page_slug and image_url are required');

  const [result] = await db.query(
    'INSERT INTO hero_slides (page_slug, title, subtitle, image_url, target_link, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [page_slug, title || null, subtitle || null, image_url, target_link || null, display_order || 0]
  );
  if (title_en || subtitle_en) {
    await db.query(
      'INSERT INTO hero_slides_translations (entity_id, lang, title, subtitle) VALUES (?, ?, ?, ?)',
      [result.insertId, 'en', title_en || null, subtitle_en || null]
    );
  }
  res.json({ message: 'Hero slide created', slideId: result.insertId });
}

async function updateHeroSlide(req, res) {
  const db = req.app.locals.db;
  const { title, subtitle, title_en, subtitle_en, image_url, target_link, display_order } = req.body;
  if (!image_url) return sendError(res, 400, 'image_url is required');

  const [result] = await db.query(
    'UPDATE hero_slides SET title = ?, subtitle = ?, image_url = ?, target_link = ?, display_order = ? WHERE id = ?',
    [title || null, subtitle || null, image_url, target_link || null, display_order || 0, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Hero slide not found');

  await db.query(
    'INSERT INTO hero_slides_translations (entity_id, lang, title, subtitle) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), subtitle = VALUES(subtitle)',
    [req.params.id, 'en', title_en || null, subtitle_en || null]
  );
  res.json({ message: 'Hero slide updated' });
}

async function deleteHeroSlide(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM hero_slides WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Hero slide not found');
  res.json({ message: 'Hero slide deleted' });
}

// --- FACILITIES & ROOMS ---

async function getFacilities(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT id, name, type, description, cover_image FROM facilities ORDER BY id ASC');
  res.json(rows);
}

async function updateFacility(req, res) {
  const db = req.app.locals.db;
  const { name, description, cover_image } = req.body;
  if (!name) return sendError(res, 400, 'Name is required');

  const [result] = await db.query(
    'UPDATE facilities SET name = ?, description = ?, cover_image = ? WHERE id = ?',
    [name, description || null, cover_image || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Facility not found');
  res.json({ message: 'Facility updated' });
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
  getSettings, updateSettings,
  getHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide,
  getFacilities, updateFacility, getRoomsByFacility, updateRoom
};
