import { MODULE_PAGE_SLUGS } from './navConfig'

/** Slugs served by dedicated Vue routes (not generic CMS /:slug). */
export const SHORT_PAGE_PATHS = {
  pocetna: '/',
  smestaj: '/smestaj',
  restoran: '/restoran',
  vesti: '/vesti',
  istrazi: '/istrazi',
  kontakt: '/kontakt',
  edukacija: '/edukacija',
  istrazivanje: '/istrazivanje',
  faq: '/faq',
}

/**
 * First path segment reserved by the app (cannot be a CMS page slug).
 * Keep in sync with backend RESERVED_PAGE_SLUGS.
 */
export const RESERVED_PAGE_SLUGS = new Set([
  ...MODULE_PAGE_SLUGS,
  'edukacija',
  'istrazivanje',
  'faq',
  'admin',
  'prijava',
  'moj-nalog',
  'reset-lozinka',
  'cancel',
  'stranica',
  'uploads',
  'images',
  'themes',
  'api',
])

/** @deprecated use MODULE_PAGE_SLUGS — kept for tests/call sites */
export const NAV_SKIP_SLUGS = new Set(MODULE_PAGE_SLUGS)

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidPageSlugFormat(slug) {
  return Boolean(slug) && SLUG_RE.test(String(slug).trim())
}

export function isReservedPageSlug(slug) {
  if (!slug) return true
  return RESERVED_PAGE_SLUGS.has(String(slug).trim().toLowerCase())
}

export function publicPathForSlug(slug) {
  if (!slug) return ''
  if (SHORT_PAGE_PATHS[slug]) return SHORT_PAGE_PATHS[slug]
  return `/${slug}`
}

export function isModulePageSlug(slug) {
  return MODULE_PAGE_SLUGS.includes(slug)
}
