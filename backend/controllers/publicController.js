const { createInquiryWithGuest } = require('../services/inquiryService');
const { sendError } = require('../utils/response');

const BADGE_TRANSLATIONS = {
  'Централни објекат': 'Central building',
  'Близу ресторана': 'Near the restaurant',
  'Ресторан': 'Restaurant',
  'Модеран дизајн': 'Modern design',
  'Брз интернет': 'Fast internet',
  'Конференцијска сала': 'Conference hall',
  'Мирна локација': 'Quiet location',
  '5 мин до ски стазе': '5 min from the ski slope',
  'Башта': 'Garden',
  'Повољан смештај': 'Affordable accommodation'
};

function normalizeJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function localizeCapacity(value, lang) {
  if (!value || lang !== 'en') return value;

  let localized = String(value).trim();

  localized = localized.replace(/^Deo od\s+(\d+)\s+лежајева$/i, 'Part of $1 beds');
  localized = localized.replace(/^Од\s+(\d+)\s+до\s+(\d+)\s+особе$/i, 'From $1 to $2 guests');
  localized = localized.replace(/^Од\s+(\d+)\s+до\s+(\d+)\s+особа$/i, 'From $1 to $2 guests');
  localized = localized.replace(/^(\d+)\s+особа$/i, '$1 guest');
  localized = localized.replace(/^(\d+)\s+особе$/i, '$1 guests');
  localized = localized.replace(/^(\d+)\s+лежаја$/i, '$1 beds');
  localized = localized.replace(/^(\d+)\s+лежајева$/i, '$1 beds');

  return localized;
}

function localizeBadges(value, lang) {
  const badges = normalizeJsonArray(value);
  if (lang !== 'en') return badges;
  return badges.map((badge) => BADGE_TRANSLATIONS[badge] || badge);
}

function localizeFacility(facility, lang) {
  facility.capacity = localizeCapacity(facility.capacity, lang);
  facility.location_badges = localizeBadges(facility.location_badges, lang);
  return facility;
}

function localizeRoom(room, lang) {
  room.capacity = localizeCapacity(room.capacity, lang);
  return room;
}

async function getHome(req, res) {
  const db = req.app.locals.db;
  const lang = req.query.lang || 'sr';
  const langParam = lang === 'sr' ? '__none__' : lang;

  const [facilities] = await db.query(`
    SELECT f.id, f.type,
      COALESCE(ft.name, f.name) AS name,
      COALESCE(ft.description, f.description) AS description,
      f.capacity, f.latitude, f.longitude, f.cover_image, f.floor_plan_image, f.location_badges,
      GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM facilities f
    LEFT JOIN facility_translations ft ON f.id = ft.entity_id AND ft.lang = ?
    LEFT JOIN media_gallery mg ON mg.entity_id = f.id AND mg.entity_type = 'facility'
    WHERE f.type = 'smestaj'
    GROUP BY f.id
    ORDER BY f.id
    LIMIT 6
  `, [langParam]);

  facilities.forEach(facility => {
    facility.gallery = facility.gallery_urls ? facility.gallery_urls.split(',') : [];
    delete facility.gallery_urls;
    localizeFacility(facility, lang);
  });

  const [news] = await db.query(`
    SELECT n.id,
      COALESCE(nt.title, n.title) AS title,
      COALESCE(nt.excerpt, n.excerpt) AS excerpt,
      COALESCE(nt.content, n.content) AS content,
      n.cover_image, n.created_at, n.slug, n.likes,
      GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM news n
    LEFT JOIN news_translations nt ON n.id = nt.entity_id AND nt.lang = ?
    LEFT JOIN media_gallery mg ON mg.entity_id = n.id AND mg.entity_type = 'news'
    GROUP BY n.id
    ORDER BY n.created_at DESC
    LIMIT 7
  `, [langParam]);

  news.forEach(item => {
    item.gallery = item.gallery_urls ? item.gallery_urls.split(',') : [];
    delete item.gallery_urls;
  });

  const [pages] = await db.query(`
    SELECT COALESCE(pt.title, p.title) AS title,
           COALESCE(pt.content, p.content) AS content
    FROM pages p
    LEFT JOIN page_translations pt ON p.id = pt.entity_id AND pt.lang = ?
    WHERE p.slug = 'pocetna'
    LIMIT 1
  `, [langParam]);

  const [slides] = await db.query(`
    SELECT hs.id,
      COALESCE(hst.title, hs.title) AS title,
      COALESCE(hst.subtitle, hs.subtitle) AS subtitle,
      hs.image_url,
      hs.target_link,
      hs.display_order
    FROM hero_slides hs
    LEFT JOIN hero_slides_translations hst ON hs.id = hst.entity_id AND hst.lang = ?
    WHERE hs.page_slug = 'pocetna'
    ORDER BY hs.display_order ASC, hs.id ASC
  `, [langParam]);

  const pageTitle = pages.length > 0 ? pages[0].title : (lang === 'en' ? 'TEACHING BASE GOČ' : 'БАЗА ГОЧ');
  const textContent = pages.length > 0 ? pages[0].content : (lang === 'en'
    ? 'Welcome to the Goč Teaching Base of the Faculty of Forestry, University of Belgrade.'
    : 'Добродошли на Наставну базу Гоч Шумарског факултета Универзитета у Београду.');

  res.json({
    news,
    facilities,
    pageTitle,
    textContent,
    slides
  });
}

async function getFacilities(req, res) {
  const db = req.app.locals.db;
  const lang = req.query.lang || 'sr';
  const langParam = lang === 'sr' ? '__none__' : lang;

  const [facilities] = await db.query(`
    SELECT f.id, f.type,
      COALESCE(ft.name, f.name) AS name,
      COALESCE(ft.description, f.description) AS description,
      f.capacity, f.latitude, f.longitude, f.cover_image, f.floor_plan_image, f.location_badges,
      GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM facilities f
    LEFT JOIN facility_translations ft ON f.id = ft.entity_id AND ft.lang = ?
    LEFT JOIN media_gallery mg ON mg.entity_id = f.id AND mg.entity_type = 'facility'
    WHERE f.type = 'smestaj'
    GROUP BY f.id
    ORDER BY f.id
  `, [langParam]);

  facilities.forEach(facility => {
    facility.gallery = facility.gallery_urls ? facility.gallery_urls.split(',') : [];
    delete facility.gallery_urls;
    localizeFacility(facility, lang);
  });

  res.json(facilities);
}

async function getFacility(req, res) {
  const db = req.app.locals.db;
  const facilityId = req.params.id;
  const lang = req.query.lang || 'sr';
  const langParam = lang === 'sr' ? '__none__' : lang;

  const [facilities] = await db.query(`
    SELECT f.id, f.type,
      COALESCE(ft.name, f.name) AS name,
      COALESCE(ft.description, f.description) AS description,
      f.capacity, f.latitude, f.longitude, f.cover_image, f.floor_plan_image, f.location_badges,
      GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM facilities f
    LEFT JOIN facility_translations ft ON f.id = ft.entity_id AND ft.lang = ?
    LEFT JOIN media_gallery mg ON mg.entity_id = f.id AND mg.entity_type = 'facility'
    WHERE f.id = ?
    GROUP BY f.id
  `, [langParam, facilityId]);

  if (facilities.length === 0) {
    return sendError(res, 404, 'Facility not found');
  }

  const facility = facilities[0];
  facility.gallery = facility.gallery_urls ? facility.gallery_urls.split(',') : [];
  delete facility.gallery_urls;
  localizeFacility(facility, lang);

  const [rooms] = await db.query(`
    SELECT r.id, r.facility_id,
      COALESCE(rt.name, r.name) AS name,
      COALESCE(rt.description, r.description) AS description,
      r.capacity, r.cover_image, r.floor_plan_image, r.amenities,
      GROUP_CONCAT(mg.image_url) as room_gallery_urls
    FROM rooms r
    LEFT JOIN room_translations rt ON r.id = rt.entity_id AND rt.lang = ?
    LEFT JOIN media_gallery mg ON mg.entity_id = r.id AND mg.entity_type = 'room'
    WHERE r.facility_id = ?
    GROUP BY r.id
  `, [langParam, facilityId]);

  rooms.forEach(room => {
    room.gallery = room.room_gallery_urls ? room.room_gallery_urls.split(',') : [];
    delete room.room_gallery_urls;
    localizeRoom(room, lang);
  });

  facility.rooms = rooms;
  res.json(facility);
}

async function getRoomAvailability(req, res) {
  const db = req.app.locals.db;
  const roomId = req.params.id;
  const { start, end } = req.query;

  if (!start || !end) {
    const [reservations] = await db.query(`
      SELECT start_date, end_date
      FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed')
      ORDER BY start_date ASC
    `, [roomId]);

    return res.json(reservations);
  }

  const [reservations] = await db.query(`
    SELECT start_date, end_date
    FROM reservations
    WHERE room_id = ? AND status IN ('pending', 'confirmed')
    AND (
      (start_date <= ? AND end_date > ?) OR
      (start_date < ? AND end_date >= ?) OR
      (start_date >= ? AND end_date <= ?)
    )
  `, [roomId, start, start, end, end, start, end]);

  const isAvailable = reservations.length === 0;
  res.json({ available: isAvailable, conflictingReservations: reservations });
}

async function submitInquiry(req, res) {
  const db = req.app.locals.db;
  try {
    const result = await createInquiryWithGuest(db, {
      ...req.validated,
      guestId: req.user?.id || null,
      allowExistingGuestByEmail: true
    });

    res.json({
      message: 'Inquiry submitted successfully',
      inquiryId: result.inquiryId,
      newAccount: result.newAccount
    });
  } catch (error) {
    if (error.code === 'ROOM_UNAVAILABLE') {
      return sendError(res, 409, error.message);
    }
    throw error;
  }
}

async function getNewsList(req, res) {
  const db = req.app.locals.db;
  const lang = req.query.lang || 'sr';

  const [news] = await db.query(`
    SELECT n.id,
      COALESCE(nt.title, n.title) AS title,
      COALESCE(nt.excerpt, n.excerpt) AS excerpt,
      COALESCE(nt.content, n.content) AS content,
      n.cover_image, n.created_at, n.slug, n.likes
    FROM news n
    LEFT JOIN news_translations nt ON n.id = nt.entity_id AND nt.lang = ?
    ORDER BY n.created_at DESC
  `, [lang === 'sr' ? '__none__' : lang]);

  res.json(news);
}

async function getSingleNews(req, res) {
  const db = req.app.locals.db;
  const newsRef = req.params.id;
  const lang = req.query.lang || 'sr';
  const isNumericRef = /^\d+$/.test(newsRef);
  const langParam = lang === 'sr' ? '__none__' : lang;

  const whereClause = isNumericRef ? 'n.id = ?' : 'n.slug = ?';
  const param = isNumericRef ? Number(newsRef) : newsRef;

  const [news] = await db.query(`
    SELECT n.id,
      COALESCE(nt.title, n.title) AS title,
      COALESCE(nt.excerpt, n.excerpt) AS excerpt,
      COALESCE(nt.content, n.content) AS content,
      n.cover_image, n.created_at, n.slug, n.likes
    FROM news n
    LEFT JOIN news_translations nt ON n.id = nt.entity_id AND nt.lang = ?
    WHERE ${whereClause} LIMIT 1
  `, [langParam, param]);

  if (news.length === 0) {
    return sendError(res, 404, 'News not found');
  }

  const item = news[0];

  const [gallery] = await db.query(`
    SELECT image_url, caption
    FROM media_gallery
    WHERE entity_type = 'news' AND entity_id = ?
    ORDER BY id ASC
  `, [item.id]);

  item.gallery = gallery;
  res.json(item);
}

async function likeNews(req, res) {
  const db = req.app.locals.db;
  const newsRef = req.params.id;
  const isNumericRef = /^\d+$/.test(newsRef);

  const [result] = isNumericRef
    ? await db.query('UPDATE news SET likes = likes + 1 WHERE id = ?', [Number(newsRef)])
    : await db.query('UPDATE news SET likes = likes + 1 WHERE slug = ?', [newsRef]);

  if (result.affectedRows === 0) {
    return sendError(res, 404, 'News not found');
  }

  const [rows] = isNumericRef
    ? await db.query('SELECT id, likes FROM news WHERE id = ? LIMIT 1', [Number(newsRef)])
    : await db.query('SELECT id, likes FROM news WHERE slug = ? LIMIT 1', [newsRef]);

  res.json({ message: 'Liked', likes: rows[0]?.likes ?? 0 });
}

async function getContactPage(req, res) {
  const db = req.app.locals.db;
  const [staff] = await db.query('SELECT id, full_name, role, contact_email, photo_url FROM staff ORDER BY id');
  const [projects] = await db.query('SELECT id, title, description, status, start_date FROM projects ORDER BY start_date DESC');
  res.json({ staff, projects });
}

async function getPageBySlug(req, res) {
  const db = req.app.locals.db;
  const lang = req.query.lang || 'sr';
  const langParam = lang === 'en' ? 'en' : null;

  const [rows] = await db.query(`
    SELECT p.slug,
           COALESCE(pt.title, p.title) AS title,
           COALESCE(pt.content, p.content) AS content
    FROM pages p
    LEFT JOIN page_translations pt ON p.id = pt.entity_id AND pt.lang = ?
    WHERE p.slug = ?
    LIMIT 1
  `, [langParam, req.params.slug]);

  if (!rows.length) return sendError(res, 404, 'Page not found');
  res.json(rows[0]);
}

module.exports = {
  getHome,
  getFacilities,
  getFacility,
  getRoomAvailability,
  submitInquiry,
  getNewsList,
  getSingleNews,
  likeNews,
  getContactPage,
  getPageBySlug
};
