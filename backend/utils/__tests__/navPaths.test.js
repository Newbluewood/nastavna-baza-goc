const {
  pathForPageSlug,
  shouldAutoAddNavForSlug,
  isValidPageSlugFormat,
  isReservedPageSlug,
} = require('../navPaths');

describe('navPaths', () => {
  test('maps short and generic paths', () => {
    expect(pathForPageSlug('pocetna')).toBe('/');
    expect(pathForPageSlug('edukacija')).toBe('/edukacija');
    expect(pathForPageSlug('test-test')).toBe('/test-test');
  });

  test('auto-nav only for non-module CMS pages', () => {
    expect(shouldAutoAddNavForSlug('smestaj')).toBe(false);
    expect(shouldAutoAddNavForSlug('vesti')).toBe(false);
    expect(shouldAutoAddNavForSlug('edukacija')).toBe(true);
    expect(shouldAutoAddNavForSlug('test-test')).toBe(true);
  });

  test('slug format and reserved list', () => {
    expect(isValidPageSlugFormat('o-nama')).toBe(true);
    expect(isValidPageSlugFormat('Bad')).toBe(false);
    expect(isReservedPageSlug('admin')).toBe(true);
    expect(isReservedPageSlug('o-nama')).toBe(false);
  });
});
