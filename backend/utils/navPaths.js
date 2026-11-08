/** Keep in sync with frontend SHORT_PAGE_PATHS / MODULE_PAGE_SLUGS. */

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

function pathForPageSlug(slug) {
  if (!slug) return '';
  if (SHORT_PAGE_PATHS[slug]) return SHORT_PAGE_PATHS[slug];
  return `/stranica/${slug}`;
}

/** New CMS pages get a nav row; module shells are seeded separately. */
function shouldAutoAddNavForSlug(slug) {
  return Boolean(slug) && !MODULE_PAGE_SLUGS.has(slug);
}

module.exports = {
  SHORT_PAGE_PATHS,
  MODULE_PAGE_SLUGS,
  pathForPageSlug,
  shouldAutoAddNavForSlug,
};
