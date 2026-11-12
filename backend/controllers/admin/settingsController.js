const { sendError } = require('../../utils/response');
const { scheduleKnowledgeIngest } = require('../../services/knowledgeIngestNotify');

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
  scheduleKnowledgeIngest('settings-update');
  res.json({ message: 'Settings updated' });
}

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
  scheduleKnowledgeIngest('hero-create');
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
  scheduleKnowledgeIngest('hero-update');
  res.json({ message: 'Hero slide updated' });
}

async function deleteHeroSlide(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM hero_slides WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return sendError(res, 404, 'Hero slide not found');
  scheduleKnowledgeIngest('hero-delete');
  res.json({ message: 'Hero slide deleted' });
}

module.exports = {
  getSettings,
  updateSettings,
  getHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
};
