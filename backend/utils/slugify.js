/** Build URL-safe slug from Serbian (Cyrillic/Latin) names. */

const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'c', џ: 'dz', ш: 's',
  А: 'a', Б: 'b', В: 'v', Г: 'g', Д: 'd', Ђ: 'dj', Е: 'e', Ж: 'z', З: 'z',
  И: 'i', Ј: 'j', К: 'k', Л: 'l', Љ: 'lj', М: 'm', Н: 'n', Њ: 'nj', О: 'o',
  П: 'p', Р: 'r', С: 's', Т: 't', Ћ: 'c', У: 'u', Ф: 'f', Х: 'h', Ц: 'c',
  Ч: 'c', Џ: 'dz', Ш: 's',
};

const LAT_DIACRITICS = {
  š: 's', Š: 's', č: 'c', Č: 'c', ć: 'c', Ć: 'c',
  ž: 'z', Ž: 'z', đ: 'dj', Đ: 'dj',
};

function slugify(input, { fallback = 'stavka' } = {}) {
  let text = String(input || '').trim();
  if (!text) return fallback;

  text = text
    .split('')
    .map((ch) => CYR_TO_LAT[ch] || LAT_DIACRITICS[ch] || ch)
    .join('');

  text = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return text || fallback;
}

module.exports = { slugify };
