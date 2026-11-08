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

module.exports = {
  isPlaceholderMediaUrl,
  parseConcatGallery,
  assertGalleryShape,
};
