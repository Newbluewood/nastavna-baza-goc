const {
  isPlaceholderMediaUrl,
  parseConcatGallery,
  assertGalleryShape,
  sanitizeGalleryItems,
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

describe('sanitizeGalleryItems', () => {
  test('normalizes captions/sort_order and drops placeholders', () => {
    expect(
      sanitizeGalleryItems([
        { image_url: '/uploads/a.jpg', caption: 'A' },
        { image_url: 'placeholder.jpg' },
        { image_url: '  /uploads/b.jpg  ' },
        null,
      ])
    ).toEqual([
      { image_url: '/uploads/a.jpg', caption: 'A', sort_order: 1 },
      { image_url: '/uploads/b.jpg', caption: '', sort_order: 3 },
    ]);
  });

  test('returns [] for non-arrays', () => {
    expect(sanitizeGalleryItems(null)).toEqual([]);
    expect(sanitizeGalleryItems(undefined)).toEqual([]);
  });
});

describe('facility/room hydrate contract', () => {
  test('GROUP_CONCAT row becomes public gallery without gallery_urls', () => {
    const facility = {
      id: 7,
      gallery_urls: '/uploads/a.jpg,placeholder.jpg,/uploads/b.jpg',
    };
    facility.gallery = parseConcatGallery(facility.gallery_urls);
    delete facility.gallery_urls;

    expect(facility).not.toHaveProperty('gallery_urls');
    expect(facility.gallery).toEqual([
      { image_url: '/uploads/a.jpg' },
      { image_url: '/uploads/b.jpg' },
    ]);
    expect(assertGalleryShape(facility.gallery)).toBe(true);
  });

  test('room hydrate uses room_gallery_urls the same way', () => {
    const room = {
      id: 3,
      room_gallery_urls: '/uploads/rooms/r1.jpg',
    };
    room.gallery = parseConcatGallery(room.room_gallery_urls);
    delete room.room_gallery_urls;

    expect(room).not.toHaveProperty('room_gallery_urls');
    expect(assertGalleryShape(room.gallery, 'room gallery')).toBe(true);
  });
});
