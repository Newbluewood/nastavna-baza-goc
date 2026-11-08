const {
  pathForPageSlug,
  shouldAutoAddNavForSlug,
} = require('../navPaths');

describe('navPaths', () => {
  test('maps short and generic paths', () => {
    expect(pathForPageSlug('pocetna')).toBe('/');
    expect(pathForPageSlug('edukacija')).toBe('/edukacija');
    expect(pathForPageSlug('test-test')).toBe('/stranica/test-test');
  });

  test('auto-nav only for non-module CMS pages', () => {
    expect(shouldAutoAddNavForSlug('smestaj')).toBe(false);
    expect(shouldAutoAddNavForSlug('vesti')).toBe(false);
    expect(shouldAutoAddNavForSlug('edukacija')).toBe(true);
    expect(shouldAutoAddNavForSlug('test-test')).toBe(true);
  });
});
