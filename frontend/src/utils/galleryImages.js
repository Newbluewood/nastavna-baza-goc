import { resolveMediaUrl } from './mediaUrl'

/**
 * Collect lightbox image URLs from a facility/room-like object.
 * Accepts gallery items as strings or { image_url } (public API contract).
 * Resolves /uploads paths against the API host.
 */
export function collectGalleryImages(item) {
  if (!item) return []

  const imgs = []
  const isPlaceholder = (raw) => {
    const value = String(raw || '').trim().toLowerCase()
    return !value || value === 'placeholder.jpg' || value.endsWith('/placeholder.jpg')
  }

  const push = (raw) => {
    if (isPlaceholder(raw)) return
    const url = resolveMediaUrl(raw)
    if (!url || isPlaceholder(url)) return
    if (!imgs.includes(url)) imgs.push(url)
  }

  push(item.cover_image)

  const gallery = item.gallery
  if (Array.isArray(gallery)) {
    for (const entry of gallery) {
      if (!entry) continue
      if (typeof entry === 'string') {
        push(entry)
      } else {
        push(entry.image_url)
      }
    }
  }

  return imgs
}
