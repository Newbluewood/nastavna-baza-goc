/** Keep in sync with frontend SHORT_PAGE_PATHS / MODULE_PAGE_SLUGS / RESERVED_PAGE_SLUGS. */

const SHORT_PAGE_PATHS = {
  pocetna: '/',
  smestaj: '/smestaj',
  restoran: '/restoran',
  vesti: '/vesti',
  istrazi: '/istrazi',
  kontakt: '/kontakt',
  edukacija: '/edukacija',
  istrazivanje: '/istrazivanje',
  faq: '/faq',
};

const MODULE_PAGE_SLUGS = new Set([
  'pocetna',
  'smestaj',
  'restoran',
  'vesti',
  'istrazi',
  'kontakt',
]);

const RESERVED_PAGE_SLUGS = new Set([
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
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pathForPageSlug(slug) {
  if (!slug) return '';
  if (SHORT_PAGE_PATHS[slug]) return SHORT_PAGE_PATHS[slug];
  return `/${slug}`;
}

/** New CMS pages get a nav row; module shells are seeded separately. */
function shouldAutoAddNavForSlug(slug) {
  return Boolean(slug) && !MODULE_PAGE_SLUGS.has(slug);
}

function isValidPageSlugFormat(slug) {
  return Boolean(slug) && SLUG_RE.test(String(slug).trim());
}

function isReservedPageSlug(slug) {
  if (!slug) return true;
  return RESERVED_PAGE_SLUGS.has(String(slug).trim().toLowerCase());
}

module.exports = {
  SHORT_PAGE_PATHS,
  MODULE_PAGE_SLUGS,
  RESERVED_PAGE_SLUGS,
  pathForPageSlug,
  shouldAutoAddNavForSlug,
  isValidPageSlugFormat,
  isReservedPageSlug,
};
