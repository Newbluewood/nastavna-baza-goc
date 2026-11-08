function isPlaceholderMediaUrl(url) {
  if (!url) return true;
  const normalized = String(url).trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized === '/placeholder.jpg' ||
    normalized === 'placeholder.jpg' ||
    normalized.endsWith('/placeholder.jpg')
  );
}

/**
 * GROUP_CONCAT urls → [{ image_url }] (isti oblik kao getSingleNews / admin).
 */
function parseConcatGallery(concatValue) {
  if (!concatValue) return [];
  return String(concatValue)
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url && !isPlaceholderMediaUrl(url))
    .map((image_url) => ({ image_url }));
}

function assertGalleryShape(gallery, label = 'gallery') {
  if (!Array.isArray(gallery)) {
    throw new Error(`${label} must be an array`);
  }
  for (const entry of gallery) {
    if (!entry || typeof entry !== 'object' || typeof entry.image_url !== 'string' || !entry.image_url.trim()) {
      throw new Error(`${label} entries must be { image_url: non-empty string }`);
    }
  }
  return true;
}

/**
 * Normalize admin gallery payloads for media_gallery writes.
 * Drops placeholders and empty urls; caps at 20 items.
 */
function sanitizeGalleryItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      image_url: String(item?.image_url || '').trim(),
      caption: String(item?.caption || '').trim(),
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index + 1
    }))
    .filter((item) => item.image_url && !isPlaceholderMediaUrl(item.image_url))
    .slice(0, 20);
}

/**
 * Replace all gallery rows for an entity (news / room / facility / …).
 * `connection` may be a pool or a transaction connection (both expose .query).
 */
async function replaceEntityGallery(connection, entityType, entityId, galleryItems) {
  await connection.query(
    'DELETE FROM media_gallery WHERE entity_type = ? AND entity_id = ?',
    [entityType, entityId]
  );

  const sanitized = sanitizeGalleryItems(galleryItems);
  for (const item of sanitized) {
    await connection.query(
      'INSERT INTO media_gallery (entity_type, entity_id, image_url, caption, sort_order) VALUES (?, ?, ?, ?, ?)',
      [entityType, entityId, item.image_url, item.caption || null, item.sort_order]
    );
  }

  return sanitized;
}

module.exports = {
  isPlaceholderMediaUrl,
  parseConcatGallery,
  assertGalleryShape,
  sanitizeGalleryItems,
  replaceEntityGallery,
};
