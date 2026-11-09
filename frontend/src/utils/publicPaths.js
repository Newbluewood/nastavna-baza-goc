/**
 * One public URL contract (Vue Router named locations):
 *   /{section}/{slug}
 * Prefer returning route location objects for RouterLink / router.push.
 */

export function facilityLocation(facility) {
  const slug = pickSlug(facility)
  if (!slug) throw new Error('facility.slug is required')
  return { name: 'smestaj-single', params: { slug: String(slug) } }
}

export function newsLocation(item) {
  const slug = pickSlug(item)
  if (!slug) throw new Error('news.slug is required')
  return { name: 'single-news', params: { slug: String(slug) } }
}

export function themeLocation(theme) {
  const slug = pickSlug(theme)
  if (!slug) throw new Error('theme.slug is required')
  return { name: 'tema-detail', params: { slug: String(slug) } }
}

/** Soft helpers when data might still be incomplete. */
export function facilityLocationSafe(facility) {
  if (facility?.slug) return facilityLocation(facility)
  if (facility?.id != null) return { name: 'smestaj-single', params: { slug: String(facility.id) } }
  return { name: 'smestaj' }
}

export function newsLocationSafe(item) {
  if (item?.slug) return newsLocation(item)
  if (item?.id != null) return { name: 'single-news', params: { slug: String(item.id) } }
  return { name: 'vesti' }
}

export function themeLocationSafe(theme) {
  if (theme?.slug) return themeLocation(theme)
  if (theme?.id != null) return { name: 'tema-detail', params: { slug: String(theme.id) } }
  return { name: 'istrazi' }
}

/** Resolve DB nav path → named location when possible. */
export function locationFromPath(path) {
  if (!path || path === '/') return { name: 'home' }

  const map = {
    '/smestaj': 'smestaj',
    '/restoran': 'restoran',
    '/vesti': 'vesti',
    '/kontakt': 'kontakt',
    '/istrazi': 'istrazi',
    '/edukacija': 'edukacija',
    '/istrazivanje': 'istrazivanje',
    '/faq': 'faq',
    '/prijava': 'prijava',
    '/moj-nalog': 'moj-nalog',
  }
  if (map[path]) return { name: map[path] }

  let m = path.match(/^\/smestaj\/([^/]+)$/)
  if (m) return { name: 'smestaj-single', params: { slug: m[1] } }
  m = path.match(/^\/vesti\/([^/]+)$/)
  if (m) return { name: 'single-news', params: { slug: m[1] } }
  m = path.match(/^\/istrazi\/([^/]+)$/)
  if (m) return { name: 'tema-detail', params: { slug: m[1] } }
  m = path.match(/^\/stranica\/([^/]+)$/)
  if (m) return { name: 'page', params: { slug: m[1] } }
  m = path.match(/^\/([^/]+)$/)
  if (m) return { name: 'page', params: { slug: m[1] } }

  return path
}

// Back-compat path string helpers (tests / rare call sites)
export function facilityPublicPath(facility) {
  return `/smestaj/${pickSlug(facility)}`
}
export function newsPublicPath(item) {
  return `/vesti/${pickSlug(item)}`
}
export function themePublicPath(theme) {
  return `/istrazi/${pickSlug(theme)}`
}
export function facilityPublicPathSafe(facility) {
  if (facility?.slug) return `/smestaj/${facility.slug}`
  if (facility?.id != null) return `/smestaj/${facility.id}`
  return '/smestaj'
}
export function newsPublicPathSafe(item) {
  if (item?.slug) return `/vesti/${item.slug}`
  if (item?.id != null) return `/vesti/${item.id}`
  return '/vesti'
}
export function themePublicPathSafe(theme) {
  if (theme?.slug) return `/istrazi/${theme.slug}`
  if (theme?.id != null) return `/istrazi/${theme.id}`
  return '/istrazi'
}

function pickSlug(value) {
  if (typeof value === 'string' || typeof value === 'number') return value
  return value?.slug
}
