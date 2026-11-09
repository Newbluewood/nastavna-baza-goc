const { sendError } = require('../../utils/response');
const { replaceEntityGallery } = require('../../utils/galleryShape');
const { upsertEnTranslation } = require('../../utils/upsertEnTranslation');
const { slugify } = require('../../utils/slugify');

async function getFacilities(req, res) {
  const db = req.app.locals.db;
  const [rows] = await db.query(`
    SELECT f.id, f.slug, f.name, f.type, f.description, f.cover_image,
      ft.name AS name_en, ft.description AS description_en
    FROM facilities f
    LEFT JOIN facility_translations ft ON f.id = ft.entity_id AND ft.lang = 'en'
    ORDER BY f.id ASC
  `);
  res.json(rows);
}

async function ensureUniqueFacilitySlug(db, baseSlug, excludeId = null) {
  let candidate = baseSlug;
  let n = 2;
  for (;;) {
    const [rows] = excludeId
      ? await db.query('SELECT id FROM facilities WHERE slug = ? AND id != ? LIMIT 1', [candidate, excludeId])
      : await db.query('SELECT id FROM facilities WHERE slug = ? LIMIT 1', [candidate]);
    if (!rows.length) return candidate;
    candidate = `${baseSlug}-${n}`;
    n += 1;
  }
}

async function updateFacility(req, res) {
  const db = req.app.locals.db;
  const { name, description, cover_image, name_en, description_en, slug } = req.body;
  if (!name) return sendError(res, 400, 'Name is required');

  const [existing] = await db.query('SELECT id, slug FROM facilities WHERE id = ?', [req.params.id]);
  if (!existing.length) return sendError(res, 404, 'Facility not found');

  let nextSlug = existing[0].slug;
  if (slug && String(slug).trim()) {
    nextSlug = await ensureUniqueFacilitySlug(db, slugify(slug), req.params.id);
  } else if (!nextSlug) {
    nextSlug = await ensureUniqueFacilitySlug(db, slugify(name, { fallback: `objekat-${req.params.id}` }), req.params.id);
  }

  const [result] = await db.query(
    'UPDATE facilities SET name = ?, description = ?, cover_image = ?, slug = ? WHERE id = ?',
    [name, description || null, cover_image || null, nextSlug, req.params.id]
  );
  if (result.affectedRows === 0) return sendError(res, 404, 'Facility not found');

  await upsertEnTranslation(db, 'facility_translations', req.params.id, {
    name: name_en || null,
    description: description_en || null,
  });
  res.json({ message: 'Facility updated', slug: nextSlug });
}

async function getRoomsByFacility(req, res) {
  const db = req.app.locals.db;
  const [rooms] = await db.query(`
    SELECT r.*, rt.name AS name_en, rt.description AS description_en, rt.meal_info AS meal_info_en
    FROM rooms r
    LEFT JOIN room_translations rt ON r.id = rt.entity_id AND rt.lang = 'en'
    WHERE r.facility_id = ?
    ORDER BY r.id ASC
  `, [req.params.id]);
  const [gallery] = await db.query(
    "SELECT id, entity_id, image_url, caption, sort_order FROM media_gallery WHERE entity_type = 'room' AND entity_id IN (?) ORDER BY sort_order ASC, id ASC",
    [rooms.length ? rooms.map((r) => r.id) : [0]]
  );
  rooms.forEach((room) => {
    room.gallery = gallery.filter((g) => g.entity_id === room.id);
  });
  res.json(rooms);
}

async function updateRoom(req, res) {
  const db = req.app.locals.db;
  const {
    name, capacity, price_base, price_half_board, price_full_board, meal_info, cover_image, gallery,
    name_en, description, description_en, meal_info_en,
  } = req.body;
  if (!name) return sendError(res, 400, 'Name is required');

  const [result] = await db.query(
    `UPDATE rooms SET
      name = ?,
      description = ?,
      capacity = ?,
      price_base = ?,
      price_half_board = ?,
      price_full_board = ?,
      meal_info = ?,
      cover_image = ?
    WHERE id = ?`,
    [
      name,
      description || null,
      capacity || null,
      price_base || 0,
      price_half_board || 0,
      price_full_board || 0,
      meal_info || null,
      cover_image || null,
      req.params.id,
    ]
  );

  if (result.affectedRows === 0) return sendError(res, 404, 'Room not found');

  await upsertEnTranslation(db, 'room_translations', req.params.id, {
    name: name_en || null,
    description: description_en || null,
    meal_info: meal_info_en || null,
  });

  if (gallery !== undefined) {
    await replaceEntityGallery(db, 'room', req.params.id, gallery);
  }

  res.json({ message: 'Room updated' });
}

module.exports = {
  getFacilities,
  updateFacility,
  getRoomsByFacility,
  updateRoom,
};
