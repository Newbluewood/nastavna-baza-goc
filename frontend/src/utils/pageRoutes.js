import { MODULE_PAGE_SLUGS } from './navConfig'

/** Slugs served by dedicated Vue routes (not /stranica/:slug). */
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

/** @deprecated use MODULE_PAGE_SLUGS — kept for tests/call sites */
export const NAV_SKIP_SLUGS = new Set(MODULE_PAGE_SLUGS)

export function publicPathForSlug(slug) {
  if (!slug) return ''
  if (SHORT_PAGE_PATHS[slug]) return SHORT_PAGE_PATHS[slug]
  return `/stranica/${slug}`
}

export function isModulePageSlug(slug) {
  return MODULE_PAGE_SLUGS.includes(slug)
}
