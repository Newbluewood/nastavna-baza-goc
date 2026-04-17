const { INQUIRY_STATUS } = require('../config/constants');
const emailService = require('../services/emailService');
const { sendError } = require('../utils/response');

async function getInquiries(req, res) {
  const db = req.app.locals.db;

  const [inquiries] = await db.query(`
    SELECT i.*, g.name as guest_name, g.email as guest_email, g.vouchers AS guest_vouchers,
           f.name as facility_name, r.name as room_name,
           COALESCE(hg.total_inquiries, he.total_inquiries, 0) AS guest_total_inquiries,
           COALESCE(hg.rejected_inquiries, he.rejected_inquiries, 0) AS guest_rejected_inquiries,
           COALESCE(hg.last_rejected_at, he.last_rejected_at) AS guest_last_rejected_at
    FROM inquiries i
    LEFT JOIN guests g ON i.guest_id = g.id
    LEFT JOIN rooms r ON i.target_room_id = r.id
    LEFT JOIN facilities f ON r.facility_id = f.id
    LEFT JOIN (
      SELECT
        guest_id,
        COUNT(*) AS total_inquiries,
        SUM(CASE WHEN status = 'odbijeno' THEN 1 ELSE 0 END) AS rejected_inquiries,
        MAX(CASE WHEN status = 'odbijeno' THEN created_at ELSE NULL END) AS last_rejected_at
      FROM inquiries
      WHERE guest_id IS NOT NULL
      GROUP BY guest_id
    ) hg ON hg.guest_id = i.guest_id
    LEFT JOIN (
      SELECT
        email,
        COUNT(*) AS total_inquiries,
        SUM(CASE WHEN status = 'odbijeno' THEN 1 ELSE 0 END) AS rejected_inquiries,
        MAX(CASE WHEN status = 'odbijeno' THEN created_at ELSE NULL END) AS last_rejected_at
      FROM inquiries
      WHERE email IS NOT NULL AND email <> ''
      GROUP BY email
    ) he ON he.email = i.email AND i.guest_id IS NULL
    ORDER BY i.created_at DESC
  `);

  res.json(inquiries);
}

async function getInquiryActivity(req, res) {
  const db = req.app.locals.db;
  const inquiryId = req.params.id;

  const [baseRows] = await db.query(
    'SELECT id, guest_id, email, sender_name FROM inquiries WHERE id = ? LIMIT 1',
    [inquiryId]
  );

  if (baseRows.length === 0) {
    return sendError(res, 404, 'Inquiry not found');
  }

  const base = baseRows[0];

  let inquiryHistory = [];
  let reservationHistory = [];

  if (base.guest_id) {
    const [inqRows] = await db.query(`
      SELECT i.id, i.status, i.check_in, i.check_out, i.created_at, i.rejection_reason,
             f.name AS facility_name, r.name AS room_name
      FROM inquiries i
      LEFT JOIN rooms r ON i.target_room_id = r.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      WHERE i.guest_id = ?
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [base.guest_id]);
    inquiryHistory = inqRows;

    const [resRows] = await db.query(`
      SELECT rs.id, rs.status, rs.start_date, rs.end_date, rs.cancel_token,
             i.id AS inquiry_id, i.created_at AS inquiry_created_at,
             f.name AS facility_name, r.name AS room_name
      FROM reservations rs
      JOIN inquiries i ON rs.inquiry_id = i.id
      LEFT JOIN rooms r ON rs.room_id = r.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      WHERE i.guest_id = ?
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [base.guest_id]);
    reservationHistory = resRows;
  } else if (base.email) {
    const [inqRows] = await db.query(`
      SELECT i.id, i.status, i.check_in, i.check_out, i.created_at, i.rejection_reason,
             f.name AS facility_name, r.name AS room_name
      FROM inquiries i
      LEFT JOIN rooms r ON i.target_room_id = r.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      WHERE i.email = ?
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [base.email]);
    inquiryHistory = inqRows;

    const [resRows] = await db.query(`
      SELECT rs.id, rs.status, rs.start_date, rs.end_date, rs.cancel_token,
             i.id AS inquiry_id, i.created_at AS inquiry_created_at,
             f.name AS facility_name, r.name AS room_name
      FROM reservations rs
      JOIN inquiries i ON rs.inquiry_id = i.id
      LEFT JOIN rooms r ON rs.room_id = r.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      WHERE i.email = ?
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [base.email]);
    reservationHistory = resRows;
  }

  res.json({
    inquiryId: base.id,
    guestId: base.guest_id || null,
    email: base.email || null,
    senderName: base.sender_name || null,
    inquiryHistory,
    reservationHistory
  });
}

async function updateInquiryStatus(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();
  let emailTask = null;

  try {
    await connection.beginTransaction();

    const inquiryId = req.params.id;
    const { status } = req.validated;

    const [inquiries] = await connection.query(`
      SELECT i.*, g.name, g.email, f.name as facility, r.name as room
      FROM inquiries i
      LEFT JOIN guests g ON i.guest_id = g.id
      LEFT JOIN rooms r ON i.target_room_id = r.id
      LEFT JOIN facilities f ON r.facility_id = f.id
      WHERE i.id = ?
    `, [inquiryId]);

    if (inquiries.length === 0) {
      return sendError(res, 404, 'Inquiry not found');
    }

    const inquiry = inquiries[0];

    const rejectDueToRoomConflict = async (reasonText) => {
      await connection.query(
        'UPDATE inquiries SET status = ?, rejection_reason = ? WHERE id = ?',
        [INQUIRY_STATUS.REJECTED, reasonText, inquiryId]
      );
      await connection.commit();

      if (inquiry.email) {
        try {
          await emailService.sendRejected(inquiry.email, {
            name: inquiry.name,
            reason: reasonText,
            facility: inquiry.facility,
            room: inquiry.room,
            checkIn: inquiry.check_in,
            checkOut: inquiry.check_out
          });
        } catch (emailErr) {
          console.warn('Email delivery failed after auto-reject conflict:', emailErr.message);
        }
      }

      return res.status(409).json({
        error: 'Room is no longer available for the selected dates. Inquiry was automatically rejected.',
        autoRejected: true,
        newStatus: INQUIRY_STATUS.REJECTED,
        reasonCode: 'room_taken'
      });
    };

    let rejectionReason = null;

    if (status === INQUIRY_STATUS.APPROVED) {
      const cancelToken = require('crypto').randomBytes(16).toString('hex');

      if (!inquiry.target_room_id || !inquiry.check_in || !inquiry.check_out) {
        return sendError(res, 400, 'Inquiry is missing room or date range');
      }

      // Safety net: re-check availability at approval time
      const [conflicts] = await connection.query(`
        SELECT id FROM reservations
        WHERE room_id = ? AND status IN ('pending', 'confirmed')
        AND (
          (start_date < ? AND end_date > ?) OR
          (start_date < ? AND end_date > ?) OR
          (start_date >= ? AND end_date <= ?)
        )
        LIMIT 1
      `, [inquiry.target_room_id, inquiry.check_out, inquiry.check_in,
          inquiry.check_out, inquiry.check_in, inquiry.check_in, inquiry.check_out]);

      if (conflicts.length > 0) {
        return rejectDueToRoomConflict('Termin je u međuvremenu zauzet drugim odobrenim zahtevom.');
      }

      try {
        await connection.query(`
          INSERT INTO reservations (inquiry_id, room_id, start_date, end_date, status, cancel_token, guest_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [inquiryId, inquiry.target_room_id, inquiry.check_in, inquiry.check_out, 'confirmed', cancelToken, inquiry.name || inquiry.sender_name || null]);
      } catch (insertErr) {
        if (insertErr?.code === 'ER_DUP_ENTRY') {
          return rejectDueToRoomConflict('Termin je upravo zauzet drugim zahtevom. Molimo izaberite drugi period.');
        }
        throw insertErr;
      }

      if (inquiry.email) {
        emailTask = () => emailService.sendApproved(inquiry.email, {
          name: inquiry.name,
          facility: inquiry.facility,
          room: inquiry.room,
          checkIn: inquiry.check_in,
          checkOut: inquiry.check_out,
          cancelToken,
          guestCount: 1
        });
      }
    } else if (status === INQUIRY_STATUS.REJECTED) {
      rejectionReason = 'Nažalost, za traženi period trenutno nema raspoloživih kapaciteta.';
      if (inquiry.email) {
        emailTask = () => emailService.sendRejected(inquiry.email, {
          name: inquiry.name,
          reason: rejectionReason,
          facility: inquiry.facility,
          room: inquiry.room,
          checkIn: inquiry.check_in,
          checkOut: inquiry.check_out
        });
      }
    } else if (status === INQUIRY_STATUS.CANCELLED) {
      await connection.query(
        'UPDATE reservations SET status = ? WHERE inquiry_id = ?',
        ['cancelled', inquiryId]
      );
    }

    await connection.query(
      'UPDATE inquiries SET status = ?, rejection_reason = ? WHERE id = ?',
      [status, status === INQUIRY_STATUS.REJECTED ? rejectionReason : null, inquiryId]
    );
    await connection.commit();

    if (emailTask) {
      try {
        await emailTask();
      } catch (emailErr) {
        console.warn('Email delivery failed after inquiry status update:', emailErr.message);
      }
    }

    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function createNews(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { title, excerpt, content, cover_image, title_en, excerpt_en, content_en } = req.body;

    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let slug = baseSlug;
    let suffix = 1;

    while (true) {
      const [existing] = await connection.query('SELECT id FROM news WHERE slug = ?', [slug]);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > 100) {
        return sendError(res, 400, 'Could not generate unique slug');
      }
    }

    const [result] = await connection.query(`
      INSERT INTO news (title, excerpt, content, cover_image, slug, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [title, excerpt || null, content, cover_image || '/placeholder.jpg', slug]);

    if (title_en || excerpt_en || content_en) {
      await connection.query(`
        INSERT INTO news_translations (entity_id, lang, title, excerpt, content)
        VALUES (?, 'en', ?, ?, ?)
      `, [result.insertId, title_en || null, excerpt_en || null, content_en || null]);
    }

    await connection.commit();

    res.json({ message: 'News created successfully', newsId: result.insertId, slug });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getAdminNews(req, res) {
  const db = req.app.locals.db;

  const [news] = await db.query(`
    SELECT
      n.id,
      n.title,
      n.excerpt,
      n.content,
      n.cover_image,
      n.slug,
      n.likes,
      n.created_at,
      nt.title AS title_en,
      nt.excerpt AS excerpt_en,
      nt.content AS content_en
    FROM news n
    LEFT JOIN news_translations nt ON nt.entity_id = n.id AND nt.lang = 'en'
    ORDER BY n.created_at DESC
  `);

  res.json(news);
}

async function getAdminNewsById(req, res) {
  const db = req.app.locals.db;
  const newsId = req.params.id;

  const [rows] = await db.query(`
    SELECT
      n.id,
      n.title,
      n.excerpt,
      n.content,
      n.cover_image,
      n.slug,
      n.likes,
      n.created_at,
      nt.title AS title_en,
      nt.excerpt AS excerpt_en,
      nt.content AS content_en
    FROM news n
    LEFT JOIN news_translations nt ON nt.entity_id = n.id AND nt.lang = 'en'
    WHERE n.id = ?
    LIMIT 1
  `, [newsId]);

  if (rows.length === 0) {
    return sendError(res, 404, 'News not found');
  }

  res.json(rows[0]);
}

async function updateNews(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const newsId = req.params.id;
    const { title, excerpt, content, cover_image, title_en, excerpt_en, content_en } = req.body;

    const [exists] = await connection.query('SELECT id FROM news WHERE id = ?', [newsId]);
    if (exists.length === 0) {
      return sendError(res, 404, 'News not found');
    }

    await connection.query(`
      UPDATE news
      SET title = ?, excerpt = ?, content = ?, cover_image = ?
      WHERE id = ?
    `, [title, excerpt || null, content, cover_image || '/placeholder.jpg', newsId]);

    if (title_en || excerpt_en || content_en) {
      await connection.query(`
        INSERT INTO news_translations (entity_id, lang, title, excerpt, content)
        VALUES (?, 'en', ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          excerpt = VALUES(excerpt),
          content = VALUES(content)
      `, [newsId, title_en || null, excerpt_en || null, content_en || null]);
    } else {
      await connection.query(
        "DELETE FROM news_translations WHERE entity_id = ? AND lang = 'en'",
        [newsId]
      );
    }

    await connection.commit();

    res.json({ message: 'News updated successfully' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deleteNews(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const newsId = req.params.id;

    await connection.query(
      "DELETE FROM media_gallery WHERE entity_type = 'news' AND entity_id = ?",
      [newsId]
    );

    const [deleted] = await connection.query('DELETE FROM news WHERE id = ?', [newsId]);
    if (deleted.affectedRows === 0) {
      return sendError(res, 404, 'News not found');
    }

    await connection.commit();

    res.json({ message: 'News deleted successfully' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getGuests(req, res) {
  const db = req.app.locals.db;

  const [guests] = await db.query(`
    SELECT g.*, COUNT(i.id) as inquiry_count, COUNT(r.id) as reservation_count
    FROM guests g
    LEFT JOIN inquiries i ON g.id = i.guest_id
    LEFT JOIN reservations r ON i.id = r.inquiry_id AND r.status = 'confirmed'
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `);

  res.json(guests);
}

async function addVoucher(req, res) {
  const db = req.app.locals.db;
  const guestId = req.params.id;
  const { title } = req.body;

  if (!title) {
    return sendError(res, 400, 'Title required');
  }

  const [guests] = await db.query('SELECT vouchers FROM guests WHERE id = ?', [guestId]);
  if (guests.length === 0) {
    return sendError(res, 404, 'Guest not found');
  }

  let currentVouchers = [];
  try {
    currentVouchers = guests[0].vouchers ? JSON.parse(guests[0].vouchers) : [];
  } catch {
    currentVouchers = Array.isArray(guests[0].vouchers) ? guests[0].vouchers : [];
  }

  const voucherId = Math.random().toString(36).substring(2, 10).toUpperCase();
  const voucher = {
    id: voucherId,
    title,
    status: 'active',
    created_at: new Date().toISOString()
  };

  currentVouchers.push(voucher);

  await db.query(
    'UPDATE guests SET vouchers = ? WHERE id = ?',
    [JSON.stringify(currentVouchers), guestId]
  );

  res.json({ message: 'Voucher created successfully', voucherId });
}

module.exports = {
  getInquiries,
  getInquiryActivity,
  updateInquiryStatus,
  createNews,
  getAdminNews,
  getAdminNewsById,
  updateNews,
  deleteNews,
  getGuests,
  addVoucher
};
