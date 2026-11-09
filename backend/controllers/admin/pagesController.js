const { sendError } = require('../../utils/response');
const { addNavForNewPage, syncNavLabelsForPage } = require('../../services/navSync');

async function getPages(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT p.*, pt.title AS title_en, pt.content AS content_en
    FROM pages p
    LEFT JOIN page_translations pt ON p.id = pt.entity_id AND pt.lang = 'en'
    ORDER BY p.id ASC
  `);
  res.json(rows);
}

async function getPageById(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT p.*, pt.title AS title_en, pt.content AS content_en
    FROM pages p
    LEFT JOIN page_translations pt ON p.id = pt.entity_id AND pt.lang = 'en'
    WHERE p.id = ?
  `, [req.params.id]);
  if (!rows.length) return sendError(res, 404, 'Page not found');
  res.json(rows[0]);
}

async function createPage(req, res) {
  const db = req.app.locals.db;
  const { slug, title, content, hero_image, title_en, content_en } = req.body;
  if (!slug || !title) return sendError(res, 400, 'Slug and title are required');

  const [existing] = await db.query('SELECT id FROM pages WHERE slug = ?', [slug]);
  if (existing.length) return sendError(res, 409, 'Page with this slug already exists');

  const [result] = await db.query(
    'INSERT INTO pages (slug, title, content, hero_image) VALUES (?, ?, ?, ?)',
    [slug, title, content || null, hero_image || null]
  );
  if (title_en || content_en) {
    await db.query(
      'INSERT INTO page_translations (entity_id, lang, title, content) VALUES (?, ?, ?, ?)',
      [result.insertId, 'en', title_en || null, content_en || null]
    );
  }
  await addNavForNewPage(db, {
    pageId: result.insertId,
    slug,
    title,
    titleEn: title_en || null,
  });
  res.json({ message: 'Page created', pageId: result.insertId });
}

async function updatePage(req, res) {
  const db = req.app.locals.db;
  const { title, content, hero_image, title_en, content_en } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');

  const [result] = await db.query(
    'UPDATE pages SET title = ?, content = ?, hero_image = ? WHERE id = ?',
    [title, content || null, hero_image || null, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Page not found');

  await db.query(
    `INSERT INTO page_translations (entity_id, lang, title, content)
     VALUES (?, 'en', ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
    [req.params.id, title_en || null, content_en || null]
  );
  const [pageRows] = await db.query('SELECT slug FROM pages WHERE id = ?', [req.params.id]);
  await syncNavLabelsForPage(db, req.params.id, {
    title,
    titleEn: title_en || null,
    slug: pageRows[0]?.slug || null,
  });
  res.json({ message: 'Page updated' });
}

async function deletePage(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM pages WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Page not found');
  res.json({ message: 'Page deleted' });
}

module.exports = {
  getPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
};
