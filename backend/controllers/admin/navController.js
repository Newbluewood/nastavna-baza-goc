const { sendError } = require('../../utils/response');
const { renumberAll, ensureModuleNavItems } = require('../../services/navSync');

async function getAdminNav(req, res) {
  const db = req.app.locals.db;
  await ensureModuleNavItems(db);
  const [rows] = await db.query(`
    SELECT n.id, n.label_sr, n.label_en, n.path, n.sort_order, n.is_enabled, n.page_id,
           p.slug AS page_slug
    FROM nav_items n
    LEFT JOIN pages p ON p.id = n.page_id
    ORDER BY n.sort_order ASC, n.id ASC
  `);
  res.json(rows);
}

async function updateNavItem(req, res) {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const { label_sr, label_en, path, sort_order, is_enabled } = req.body;

  if (!label_sr || !String(label_sr).trim()) {
    return sendError(res, 400, 'label_sr is required');
  }
  if (!path || !String(path).trim().startsWith('/')) {
    return sendError(res, 400, 'path must start with /');
  }

  const [result] = await db.query(
    `UPDATE nav_items
     SET label_sr = ?, label_en = ?, path = ?, sort_order = ?, is_enabled = ?
     WHERE id = ?`,
    [
      String(label_sr).trim(),
      label_en != null ? String(label_en).trim() : null,
      String(path).trim(),
      Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      is_enabled === false || is_enabled === 0 || is_enabled === '0' ? false : true,
      id,
    ]
  );

  if (result.affectedRows === 0) return sendError(res, 404, 'Nav item not found');
  res.json({ message: 'Nav item updated' });
}

async function createNavItem(req, res) {
  const db = req.app.locals.db;
  const { label_sr, label_en, path, sort_order, is_enabled } = req.body;

  if (!label_sr || !String(label_sr).trim()) {
    return sendError(res, 400, 'label_sr is required');
  }
  if (!path || !String(path).trim().startsWith('/')) {
    return sendError(res, 400, 'path must start with /');
  }

  try {
    const [result] = await db.query(
      `INSERT INTO nav_items (label_sr, label_en, path, sort_order, is_enabled, page_id)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [
        String(label_sr).trim(),
        label_en != null ? String(label_en).trim() : null,
        String(path).trim(),
        Number.isFinite(Number(sort_order)) ? Number(sort_order) : 100,
        is_enabled === false ? false : true,
      ]
    );
    await renumberAll(db);
    res.json({ message: 'Nav item created', id: result.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'Nav path already exists');
    }
    throw err;
  }
}

async function deleteNavItem(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query('SELECT id, page_id FROM nav_items WHERE id = ?', [req.params.id]);
  if (!rows.length) return sendError(res, 404, 'Nav item not found');

  // Removing a CMS-linked row only hides it from the menu; the page stays.
  await db.query('DELETE FROM nav_items WHERE id = ?', [req.params.id]);
  await renumberAll(db);
  res.json({ message: 'Nav item deleted' });
}

/** Body: { ids: number[] } — full ordered list; sort_order becomes 1..N. */
async function reorderNav(req, res) {
  const db = req.app.locals.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => Number(id)).filter((id) => id > 0) : [];
  if (!ids.length) return sendError(res, 400, 'ids array is required');

  const [existing] = await db.query('SELECT id FROM nav_items');
  if (existing.length !== ids.length) {
    return sendError(res, 400, 'ids must include every nav item exactly once');
  }
  const existingSet = new Set(existing.map((row) => row.id));
  if (ids.some((id) => !existingSet.has(id))) {
    return sendError(res, 400, 'ids contains unknown nav item');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < ids.length; i += 1) {
      await connection.query('UPDATE nav_items SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  res.json({ message: 'Nav reordered' });
}

module.exports = {
  getAdminNav,
  updateNavItem,
  createNavItem,
  deleteNavItem,
  reorderNav,
};
