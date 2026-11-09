const { slugify } = require('../slugify');

describe('slugify', () => {
  test('transliterates Cyrillic facility names', () => {
    expect(slugify('Хотел Пирамида')).toBe('hotel-piramida');
    expect(slugify('Нови Студенац')).toBe('novi-studenac');
    expect(slugify('Вила Власта')).toBe('vila-vlasta');
    expect(slugify('Кућа Гвоздац')).toBe('kuca-gvozdac');
  });

  test('handles latin diacritics and empties', () => {
    expect(slugify('Vila Bořika')).toBe('vila-borika');
    expect(slugify('')).toBe('stavka');
  });
});
