const {
  isPlaceholderMediaUrl,
  parseConcatGallery,
  assertGalleryShape,
} = require('../galleryShape');

describe('isPlaceholderMediaUrl', () => {
  test('treats empty values as placeholder', () => {
    expect(isPlaceholderMediaUrl(null)).toBe(true);
    expect(isPlaceholderMediaUrl('')).toBe(true);
    expect(isPlaceholderMediaUrl('   ')).toBe(true);
  });

  test('detects placeholder paths', () => {
    expect(isPlaceholderMediaUrl('placeholder.jpg')).toBe(true);
    expect(isPlaceholderMediaUrl('/placeholder.jpg')).toBe(true);
    expect(isPlaceholderMediaUrl('https://cdn.example/placeholder.jpg')).toBe(true);
  });

  test('allows real media paths', () => {
    expect(isPlaceholderMediaUrl('/uploads/facilities/a.jpg')).toBe(false);
  });
});

describe('parseConcatGallery', () => {
  test('returns [] for empty input', () => {
    expect(parseConcatGallery(null)).toEqual([]);
    expect(parseConcatGallery('')).toEqual([]);
  });

  test('splits GROUP_CONCAT urls into { image_url } objects', () => {
    expect(parseConcatGallery('/uploads/a.jpg,/uploads/b.jpg')).toEqual([
      { image_url: '/uploads/a.jpg' },
      { image_url: '/uploads/b.jpg' },
    ]);
  });

  test('trims and drops placeholders', () => {
    expect(
      parseConcatGallery(' /uploads/a.jpg , placeholder.jpg , /uploads/b.jpg ')
    ).toEqual([
      { image_url: '/uploads/a.jpg' },
      { image_url: '/uploads/b.jpg' },
    ]);
  });
});

describe('assertGalleryShape', () => {
  test('accepts valid gallery arrays', () => {
    expect(assertGalleryShape([{ image_url: '/uploads/a.jpg' }])).toBe(true);
    expect(assertGalleryShape([])).toBe(true);
  });

  test('rejects string arrays and malformed objects', () => {
    expect(() => assertGalleryShape(['/uploads/a.jpg'])).toThrow();
    expect(() => assertGalleryShape([{ url: '/uploads/a.jpg' }])).toThrow();
    expect(() => assertGalleryShape([{ image_url: '' }])).toThrow();
  });
});
