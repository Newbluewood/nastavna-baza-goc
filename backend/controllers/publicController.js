const bcrypt = require('bcryptjs');
const { formatDate, isAfterDays } = require('../utils/dateUtils');
const { INQUIRY_STATUS } = require('../config/constants');
const emailService = require('../services/emailService');
const { sendError } = require('../utils/response');

async function getHome(req, res) {
  const db = req.app.locals.db;
  const lang = req.query.lang || 'sr';

  const [facilities] = await db.query(`
    SELECT f.*, GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM facilities f
    LEFT JOIN media_gallery mg ON mg.entity_id = f.id AND mg.entity_type = 'facility'
    WHERE f.type = 'smestaj'
    GROUP BY f.id
    ORDER BY f.id
    LIMIT 6
  `);

  facilities.forEach(facility => {
    facility.gallery = facility.gallery_urls ? facility.gallery_urls.split(',') : [];
    delete facility.gallery_urls;
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
    LIMIT 3
  `, [lang === 'sr' ? '__none__' : lang]);

  news.forEach(item => {
    item.gallery = item.gallery_urls ? item.gallery_urls.split(',') : [];
    delete item.gallery_urls;
  });

  const pageTitle = lang === 'en' ? 'TEACHING BASE GOČ' : 'БАЗА ГОЧ';
  const textContent = lang === 'en'
    ? 'Welcome to the Goč Teaching Base of the Faculty of Forestry, University of Belgrade.'
    : 'Добродошли на Наставну базу Гоч Шумарског факултета Универзитета у Београду.';

  res.json({
    news,
    facilities,
    pageTitle,
    textContent,
    slides: []
  });
}

async function getFacilities(req, res) {
  const db = req.app.locals.db;

  const [facilities] = await db.query(`
    SELECT f.*, GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM facilities f
    LEFT JOIN media_gallery mg ON mg.entity_id = f.id AND mg.entity_type = 'facility'
    WHERE f.type = 'smestaj'
    GROUP BY f.id
    ORDER BY f.id
  `);

  facilities.forEach(facility => {
    facility.gallery = facility.gallery_urls ? facility.gallery_urls.split(',') : [];
    delete facility.gallery_urls;
  });

  res.json(facilities);
}

async function getFacility(req, res) {
  const db = req.app.locals.db;
  const facilityId = req.params.id;

  const [facilities] = await db.query(`
    SELECT f.*, GROUP_CONCAT(mg.image_url) as gallery_urls
    FROM facilities f
    LEFT JOIN media_gallery mg ON mg.entity_id = f.id AND mg.entity_type = 'facility'
    WHERE f.id = ?
    GROUP BY f.id
  `, [facilityId]);

  if (facilities.length === 0) {
    return sendError(res, 404, 'Facility not found');
  }

  const facility = facilities[0];
  facility.gallery = facility.gallery_urls ? facility.gallery_urls.split(',') : [];
  delete facility.gallery_urls;

  const [rooms] = await db.query(`
    SELECT r.*, GROUP_CONCAT(mg.image_url) as room_gallery_urls
    FROM rooms r
    LEFT JOIN media_gallery mg ON mg.entity_id = r.id AND mg.entity_type = 'room'
    WHERE r.facility_id = ?
    GROUP BY r.id
  `, [facilityId]);

  rooms.forEach(room => {
    room.gallery = room.room_gallery_urls ? room.room_gallery_urls.split(',') : [];
    delete room.room_gallery_urls;
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
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { sender_name, email, phone, message, target_room_id, check_in, check_out } = req.validated;

    // Check for overlapping confirmed reservations before creating the inquiry
    const [conflicts] = await connection.query(`
      SELECT id FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed')
      AND (
        (start_date < ? AND end_date > ?) OR
        (start_date < ? AND end_date > ?) OR
        (start_date >= ? AND end_date <= ?)
      )
      LIMIT 1
    `, [target_room_id, check_out, check_in, check_out, check_in, check_in, check_out]);

    if (conflicts.length > 0) {
      return sendError(res, 409, 'Room is not available for the selected dates');
    }

    let [guests] = await connection.query('SELECT * FROM guests WHERE email = ?', [email]);
    let guest;

    if (guests.length === 0) {
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const [result] = await connection.query(
        'INSERT INTO guests (name, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
        [sender_name, email, hashedPassword]
      );

      guest = { id: result.insertId, name: sender_name, email, password: tempPassword };
      await emailService.sendGuestCreated(email, guest);
    } else {
      guest = guests[0];
      await emailService.sendGuestExists(email, { name: guest.name });
    }

    const [inquiryResult] = await connection.query(`
      INSERT INTO inquiries (sender_name, email, phone, message, check_in, check_out, target_room_id, status, created_at, guest_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `, [sender_name, email, phone || null, message || null, check_in, check_out, target_room_id, INQUIRY_STATUS.NEW, guest.id]);

    await connection.commit();

    await emailService.sendInquiryReceived(email, { name: guest.name });

    res.json({
      message: 'Inquiry submitted successfully',
      inquiryId: inquiryResult.insertId,
      newAccount: guests.length === 0
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
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

module.exports = {
  getHome,
  getFacilities,
  getFacility,
  getRoomAvailability,
  submitInquiry,
  getNewsList,
  getSingleNews,
  likeNews
};
