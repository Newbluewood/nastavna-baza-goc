const { INQUIRY_STATUS } = require('../../config/constants');
const emailService = require('../../services/emailService');
const { sendError } = require('../../utils/response');

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

async function fetchHistory(db, column, value) {
  const [inqRows] = await db.query(`
    SELECT i.id, i.status, i.check_in, i.check_out, i.created_at, i.rejection_reason,
           f.name AS facility_name, r.name AS room_name
    FROM inquiries i
    LEFT JOIN rooms r ON i.target_room_id = r.id
    LEFT JOIN facilities f ON r.facility_id = f.id
    WHERE i.${column} = ?
    ORDER BY i.created_at DESC
    LIMIT 20
  `, [value]);

  const [resRows] = await db.query(`
    SELECT rs.id, rs.status, rs.start_date, rs.end_date, rs.cancel_token,
           i.id AS inquiry_id, i.created_at AS inquiry_created_at,
           f.name AS facility_name, r.name AS room_name
    FROM reservations rs
    JOIN inquiries i ON rs.inquiry_id = i.id
    LEFT JOIN rooms r ON rs.room_id = r.id
    LEFT JOIN facilities f ON r.facility_id = f.id
    WHERE i.${column} = ?
    ORDER BY i.created_at DESC
    LIMIT 20
  `, [value]);

  return { inquiryHistory: inqRows, reservationHistory: resRows };
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

  let history = { inquiryHistory: [], reservationHistory: [] };

  if (base.guest_id) {
    history = await fetchHistory(db, 'guest_id', base.guest_id);
  } else if (base.email) {
    history = await fetchHistory(db, 'email', base.email);
  }

  res.json({
    inquiryId: base.id,
    guestId: base.guest_id || null,
    email: base.email || null,
    senderName: base.sender_name || null,
    ...history
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

module.exports = { getInquiries, getInquiryActivity, updateInquiryStatus };
