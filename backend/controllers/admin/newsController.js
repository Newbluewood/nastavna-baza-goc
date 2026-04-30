const { sendError } = require('../../utils/response');

// Shared SELECT for news with translations
const NEWS_BASE_SELECT = `
  SELECT n.id, n.title, n.excerpt, n.content, n.cover_image, n.slug, n.likes, n.created_at,
         nt.title AS title_en, nt.excerpt AS excerpt_en, nt.content AS content_en
  FROM news n
  LEFT JOIN news_translations nt ON nt.entity_id = n.id AND nt.lang = 'en'
`;

function sanitizeGalleryItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      image_url: String(item?.image_url || '').trim(),
      caption: String(item?.caption || '').trim(),
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index + 1
    }))
    .filter((item) => item.image_url)
    .slice(0, 20);
}

async function replaceNewsGallery(connection, newsId, galleryItems) {
  await connection.query(
    "DELETE FROM media_gallery WHERE entity_type = 'news' AND entity_id = ?",
    [newsId]
  );
  const sanitized = sanitizeGalleryItems(galleryItems);
  for (const item of sanitized) {
    await connection.query(
      'INSERT INTO media_gallery (entity_type, entity_id, image_url, caption, sort_order) VALUES (?, ?, ?, ?, ?)',
      ['news', newsId, item.image_url, item.caption || null, item.sort_order]
    );
  }
}

async function getAdminNews(req, res) {
  const db = req.app.locals.db;
  const [news] = await db.query(`${NEWS_BASE_SELECT} ORDER BY n.created_at DESC`);
  res.json(news);
}

async function getAdminNewsById(req, res) {
  const db = req.app.locals.db;
  const newsId = req.params.id;

  const [rows] = await db.query(`${NEWS_BASE_SELECT} WHERE n.id = ? LIMIT 1`, [newsId]);
  if (rows.length === 0) return sendError(res, 404, 'News not found');

  const [gallery] = await db.query(
    `SELECT id, image_url, caption, sort_order
     FROM media_gallery
     WHERE entity_type = 'news' AND entity_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [newsId]
  );

  res.json({ ...rows[0], gallery });
}

async function createNews(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const { title, excerpt, content, cover_image, title_en, excerpt_en, content_en, gallery } = req.body;

    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const [existing] = await connection.query('SELECT id FROM news WHERE slug = ?', [slug]);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > 100) return sendError(res, 400, 'Could not generate unique slug');
    }

    const [result] = await connection.query(
      'INSERT INTO news (title, excerpt, content, cover_image, slug, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [title, excerpt || null, content, cover_image || '/placeholder.jpg', slug]
    );

    if (title_en || excerpt_en || content_en) {
      await connection.query(
        "INSERT INTO news_translations (entity_id, lang, title, excerpt, content) VALUES (?, 'en', ?, ?, ?)",
        [result.insertId, title_en || null, excerpt_en || null, content_en || null]
      );
    }

    await replaceNewsGallery(connection, result.insertId, gallery);
    await connection.commit();

    res.json({ message: 'News created successfully', newsId: result.insertId, slug });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateNews(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const newsId = req.params.id;
    const { title, excerpt, content, cover_image, title_en, excerpt_en, content_en, gallery } = req.body;

    const [exists] = await connection.query('SELECT id FROM news WHERE id = ?', [newsId]);
    if (exists.length === 0) return sendError(res, 404, 'News not found');

    await connection.query(
      'UPDATE news SET title = ?, excerpt = ?, content = ?, cover_image = ? WHERE id = ?',
      [title, excerpt || null, content, cover_image || '/placeholder.jpg', newsId]
    );

    if (title_en || excerpt_en || content_en) {
      await connection.query(`
        INSERT INTO news_translations (entity_id, lang, title, excerpt, content)
        VALUES (?, 'en', ?, ?, ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), excerpt = VALUES(excerpt), content = VALUES(content)
      `, [newsId, title_en || null, excerpt_en || null, content_en || null]);
    } else {
      await connection.query("DELETE FROM news_translations WHERE entity_id = ? AND lang = 'en'", [newsId]);
    }

    await replaceNewsGallery(connection, newsId, gallery);
    await connection.commit();

    res.json({ message: 'News updated successfully' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deleteNews(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const newsId = req.params.id;

    await connection.query("DELETE FROM media_gallery WHERE entity_type = 'news' AND entity_id = ?", [newsId]);
    const [deleted] = await connection.query('DELETE FROM news WHERE id = ?', [newsId]);
    if (deleted.affectedRows === 0) return sendError(res, 404, 'News not found');

    await connection.commit();
    res.json({ message: 'News deleted successfully' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { getAdminNews, getAdminNewsById, createNews, updateNews, deleteNews };
