const { sendError } = require('../../utils/response');

async function upsertEnTranslation(db, table, entityId, fields) {
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE entity_id = ? AND lang = 'en' LIMIT 1`,
    [entityId]
  );
  const keys = Object.keys(fields);
  const values = keys.map((key) => fields[key]);
  const hasValue = values.some((value) => value);
  if (rows.length) {
    await db.query(
      `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`,
      [...values, rows[0].id]
    );
    return;
  }
  if (!hasValue) return;
  await db.query(
    `INSERT INTO ${table} (entity_id, lang, ${keys.join(', ')}) VALUES (?, 'en', ${keys.map(() => '?').join(', ')})`,
    [entityId, ...values]
  );
}

async function getRestaurants(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT a.*, at.name AS name_en, at.description AS description_en
    FROM attractions a
    LEFT JOIN attraction_translations at ON a.id = at.entity_id AND at.lang = 'en'
    WHERE a.type = 'restaurant'
    ORDER BY a.id ASC
  `);
  res.json(rows);
}

async function updateRestaurant(req, res) {
  const db = req.app.locals.db;
  const { name, description, distance_km, distance_minutes, cover_image, name_en, description_en } = req.body;

  if (!name) {
    return sendError(res, 400, 'Name is required');
  }

  const [result] = await db.query(
    'UPDATE attractions SET name = ?, description = ?, distance_km = ?, distance_minutes = ?, cover_image = ? WHERE id = ? AND type = "restaurant"',
    [name, description || null, distance_km || null, distance_minutes || null, cover_image || null, req.params.id]
  );

  if (result.affectedRows === 0) {
    return sendError(res, 404, 'Restaurant not found');
  }

  await upsertEnTranslation(db, 'attraction_translations', req.params.id, {
    name: name_en || null,
    description: description_en || null
  });
  res.json({ message: 'Restaurant updated' });
}

async function getMenuItems(req, res) {
  const db = req.app.locals.db;
  const restaurantId = req.params.id;
  const [rows] = await db.query(
    `SELECT sr.id, sr.attraction_id, sr.lang, sr.category, sr.name, sr.description,
            sr.price, sr.is_available, sr.sort_order,
            en.id AS en_id, en.name AS name_en, en.description AS description_en, en.category AS category_en
     FROM restaurant_menu_items sr
     LEFT JOIN restaurant_menu_items en
       ON en.attraction_id = sr.attraction_id
      AND en.lang = 'en'
      AND en.sort_order = sr.sort_order
      AND en.id <> sr.id
     WHERE sr.attraction_id = ? AND sr.lang = 'sr'
     ORDER BY sr.sort_order ASC, sr.id ASC`,
    [restaurantId]
  );
  res.json(rows);
}

async function createMenuItem(req, res) {
  const db = req.app.locals.db;
  const {
    attraction_id, lang, category, name, description, price, is_available, sort_order,
    name_en, description_en, category_en
  } = req.body;

  if (!attraction_id || !name) {
    return sendError(res, 400, 'Restaurant ID and Name are required');
  }

  const [result] = await db.query(
    'INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price, is_available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [attraction_id, lang || 'sr', category || null, name, description || null, price || null, is_available !== undefined ? is_available : true, sort_order || 0]
  );

  if (name_en || description_en || category_en) {
    await db.query(
      'INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price, is_available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [attraction_id, 'en', category_en || category || null, name_en || name, description_en || null, price || null, is_available !== undefined ? is_available : true, sort_order || 0]
    );
  }

  res.json({ message: 'Menu item created', id: result.insertId });
}

async function findEnglishSibling(db, item) {
  const [enRows] = await db.query(
    `SELECT id FROM restaurant_menu_items
     WHERE attraction_id = ? AND lang = 'en' AND sort_order = ? AND id <> ?
     LIMIT 1`,
    [item.attraction_id, item.sort_order, item.id]
  );
  return enRows[0] || null;
}

async function updateMenuItem(req, res) {
  const db = req.app.locals.db;
  const {
    category, name, description, price, is_available, sort_order,
    name_en, description_en, category_en
  } = req.body;

  if (!name) {
    return sendError(res, 400, 'Name is required');
  }

  const [currentRows] = await db.query('SELECT * FROM restaurant_menu_items WHERE id = ?', [req.params.id]);
  if (!currentRows.length) return sendError(res, 404, 'Menu item not found');
  const current = currentRows[0];

  const [result] = await db.query(
    'UPDATE restaurant_menu_items SET category = ?, name = ?, description = ?, price = ?, is_available = ?, sort_order = ? WHERE id = ?',
    [category || null, name, description || null, price || null, is_available !== undefined ? is_available : true, sort_order || 0, req.params.id]
  );

  if (result.affectedRows === 0) {
    return sendError(res, 404, 'Menu item not found');
  }

  const sibling = await findEnglishSibling(db, current);
  const enName = name_en || null;
  const enDescription = description_en || null;
  const enCategory = category_en || category || null;
  const hasEn = enName || enDescription || category_en;

  if (sibling) {
    await db.query(
      'UPDATE restaurant_menu_items SET category = ?, name = ?, description = ?, price = ?, is_available = ?, sort_order = ? WHERE id = ?',
      [enCategory, enName || name, enDescription, price || null, is_available !== undefined ? is_available : true, sort_order || 0, sibling.id]
    );
  } else if (hasEn) {
    await db.query(
      'INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price, is_available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [current.attraction_id, 'en', enCategory, enName || name, enDescription, price || null, is_available !== undefined ? is_available : true, sort_order || 0]
    );
  }

  res.json({ message: 'Menu item updated' });
}

async function deleteMenuItem(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM restaurant_menu_items WHERE id = ?', [req.params.id]);
  if (!rows.length) {
    return sendError(res, 404, 'Menu item not found');
  }
  const item = rows[0];
  await db.query(
    'DELETE FROM restaurant_menu_items WHERE id = ? OR (attraction_id = ? AND lang = ? AND sort_order = ? AND id <> ?)',
    [item.id, item.attraction_id, 'en', item.sort_order, item.id]
  );
  res.json({ message: 'Menu item deleted' });
}

module.exports = {
  getRestaurants,
  updateRestaurant,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
