const { sendError } = require('../../utils/response');

async function getThemes(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT t.id, t.slug, t.icon, t.hero_image, t.keywords, t.display_order,
      MAX(CASE WHEN tt.lang = 'sr' THEN tt.name END) as name_sr,
      MAX(CASE WHEN tt.lang = 'en' THEN tt.name END) as name_en
    FROM themes t
    LEFT JOIN theme_translations tt ON t.id = tt.entity_id
    GROUP BY t.id
    ORDER BY t.display_order ASC, t.id ASC
  `);
  res.json(rows);
}

async function getThemeById(req, res) {
  const db = req.app.locals.db;
  const [themes] = await db.query('SELECT * FROM themes WHERE id = ?', [req.params.id]);
  if (!themes.length) return sendError(res, 404, 'Theme not found');
  const [translations] = await db.query('SELECT lang, name, article FROM theme_translations WHERE entity_id = ?', [req.params.id]);
  const theme = themes[0];
  const sr = translations.find((t) => t.lang === 'sr') || {};
  const en = translations.find((t) => t.lang === 'en') || {};
  res.json({
    ...theme,
    name_sr: sr.name || '',
    article_sr: sr.article || '',
    name_en: en.name || '',
    article_en: en.article || '',
  });
}

async function createTheme(req, res) {
  const db = req.app.locals.db;
  const { slug, icon, hero_image, keywords, display_order, name_sr, article_sr, name_en, article_en } = req.body;
  if (!slug || !name_sr) return sendError(res, 400, 'Slug and Serbian name are required');

  const [existing] = await db.query('SELECT id FROM themes WHERE slug = ?', [slug]);
  if (existing.length) return sendError(res, 409, 'Theme with this slug already exists');

  const [result] = await db.query(
    'INSERT INTO themes (slug, icon, hero_image, keywords, display_order) VALUES (?, ?, ?, ?, ?)',
    [slug, icon || null, hero_image || null, JSON.stringify(keywords || []), display_order || 0]
  );
  const themeId = result.insertId;
  await db.query(
    'INSERT INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?)',
    [themeId, 'sr', name_sr, article_sr || null]
  );
  if (name_en || article_en) {
    await db.query(
      'INSERT INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?)',
      [themeId, 'en', name_en || null, article_en || null]
    );
  }
  res.json({ message: 'Theme created', themeId });
}

async function updateTheme(req, res) {
  const db = req.app.locals.db;
  const { slug, icon, hero_image, keywords, display_order, name_sr, article_sr, name_en, article_en } = req.body;
  if (!slug || !name_sr) return sendError(res, 400, 'Slug and Serbian name are required');

  const [result] = await db.query(
    'UPDATE themes SET slug = ?, icon = ?, hero_image = ?, keywords = ?, display_order = ? WHERE id = ?',
    [slug, icon || null, hero_image || null, JSON.stringify(keywords || []), display_order || 0, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Theme not found');

  await db.query(
    'INSERT INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), article = VALUES(article)',
    [req.params.id, 'sr', name_sr, article_sr || null]
  );
  await db.query(
    'INSERT INTO theme_translations (entity_id, lang, name, article) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), article = VALUES(article)',
    [req.params.id, 'en', name_en || null, article_en || null]
  );
  res.json({ message: 'Theme updated' });
}

async function deleteTheme(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM themes WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Theme not found');
  res.json({ message: 'Theme deleted' });
}

module.exports = {
  getThemes,
  getThemeById,
  createTheme,
  updateTheme,
  deleteTheme,
};
