const { sendError } = require('../../utils/response');

/**
 * Get all restaurants (attractions with type='restaurant')
 */
async function getRestaurants(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query("SELECT * FROM attractions WHERE type = 'restaurant' ORDER BY id ASC");
  res.json(rows);
}

/**
 * Update restaurant basic info
 */
async function updateRestaurant(req, res) {
  const db = req.app.locals.db;
  const { name, description, distance_km, distance_minutes, cover_image } = req.body;

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

  res.json({ message: 'Restaurant updated' });
}

/**
 * Get menu items for a specific restaurant
 */
async function getMenuItems(req, res) {
  const db = req.app.locals.db;
  const restaurantId = req.params.id;
  const [rows] = await db.query(
    'SELECT * FROM restaurant_menu_items WHERE attraction_id = ? ORDER BY sort_order ASC, id ASC',
    [restaurantId]
  );
  res.json(rows);
}

/**
 * Create a new menu item
 */
async function createMenuItem(req, res) {
  const db = req.app.locals.db;
  const { attraction_id, lang, category, name, description, price, is_available, sort_order } = req.body;

  if (!attraction_id || !name) {
    return sendError(res, 400, 'Restaurant ID and Name are required');
  }

  const [result] = await db.query(
    'INSERT INTO restaurant_menu_items (attraction_id, lang, category, name, description, price, is_available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [attraction_id, lang || 'sr', category || null, name, description || null, price || null, is_available !== undefined ? is_available : true, sort_order || 0]
  );

  res.json({ message: 'Menu item created', id: result.insertId });
}

/**
 * Update a menu item
 */
async function updateMenuItem(req, res) {
  const db = req.app.locals.db;
  const { category, name, description, price, is_available, sort_order } = req.body;

  if (!name) {
    return sendError(res, 400, 'Name is required');
  }

  const [result] = await db.query(
    'UPDATE restaurant_menu_items SET category = ?, name = ?, description = ?, price = ?, is_available = ?, sort_order = ? WHERE id = ?',
    [category || null, name, description || null, price || null, is_available !== undefined ? is_available : true, sort_order || 0, req.params.id]
  );

  if (result.affectedRows === 0) {
    return sendError(res, 404, 'Menu item not found');
  }

  res.json({ message: 'Menu item updated' });
}

/**
 * Delete a menu item
 */
async function deleteMenuItem(req, res) {
  const db = req.app.locals.db;
  const [result] = await db.query('DELETE FROM restaurant_menu_items WHERE id = ?', [req.params.id]);

  if (result.affectedRows === 0) {
    return sendError(res, 404, 'Menu item not found');
  }

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
