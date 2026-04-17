const bcrypt = require('bcryptjs');
const { guestAuthMiddleware, signGuestToken } = require('../middleware/auth');
const { sendError } = require('../utils/response');

async function guestLogin(req, res) {
  const { email, password } = req.validated;
  const db = req.app.locals.db;

  const [guests] = await db.query('SELECT * FROM guests WHERE email = ?', [email]);
  if (guests.length === 0) {
    return sendError(res, 401, 'Invalid credentials');
  }

  const guest = guests[0];
  const isValidPassword = await bcrypt.compare(password, guest.password_hash);
  if (!isValidPassword) {
    return sendError(res, 401, 'Invalid credentials');
  }

  const token = signGuestToken(guest);
  res.json({
    token,
    guest: { id: guest.id, name: guest.name, email: guest.email }
  });
}

async function getMe(req, res) {
  const db = req.app.locals.db;
  const guestId = req.user.id;

  const [guests] = await db.query(`
    SELECT g.*, COUNT(DISTINCT i.id) as inquiry_count, COUNT(DISTINCT r.id) as reservation_count
    FROM guests g
    LEFT JOIN inquiries i ON g.id = i.guest_id
    LEFT JOIN reservations r ON i.id = r.inquiry_id AND r.status = 'confirmed'
    WHERE g.id = ?
    GROUP BY g.id
  `, [guestId]);

  if (guests.length === 0) {
    return sendError(res, 404, 'Guest not found');
  }

  const guest = guests[0];
  delete guest.password_hash;
  res.json(guest);
}

async function redeemVoucher(req, res) {
  const db = req.app.locals.db;
  const voucherId = req.params.voucherId;
  const guestId = req.user.id;

  const [guests] = await db.query('SELECT vouchers FROM guests WHERE id = ?', [guestId]);
  if (guests.length === 0) {
    return sendError(res, 404, 'Guest not found');
  }

  let vouchers = [];
  try {
    vouchers = guests[0].vouchers ? JSON.parse(guests[0].vouchers) : [];
  } catch {
    vouchers = Array.isArray(guests[0].vouchers) ? guests[0].vouchers : [];
  }

  const voucherIndex = vouchers.findIndex(v => v.id === voucherId && v.status === 'active');
  if (voucherIndex === -1) {
    return sendError(res, 404, 'Voucher not found or already redeemed');
  }

  vouchers[voucherIndex] = {
    ...vouchers[voucherIndex],
    status: 'redeemed',
    redeemed_at: new Date().toISOString()
  };

  await db.query('UPDATE guests SET vouchers = ? WHERE id = ?', [JSON.stringify(vouchers), guestId]);

  res.json({ message: 'Voucher redeemed successfully', vouchers });
}

async function changePassword(req, res) {
  const db = req.app.locals.db;
  const guestId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return sendError(res, 400, 'currentPassword and newPassword are required');
  }
  if (newPassword.length < 6) {
    return sendError(res, 400, 'New password must be at least 6 characters');
  }

  const [guests] = await db.query('SELECT id, password_hash FROM guests WHERE id = ?', [guestId]);
  if (guests.length === 0) {
    return sendError(res, 404, 'Guest not found');
  }

  const isValid = await bcrypt.compare(currentPassword, guests[0].password_hash);
  if (!isValid) {
    return sendError(res, 401, 'Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE guests SET password_hash = ? WHERE id = ?', [newHash, guestId]);

  res.json({ message: 'Password updated successfully' });
}

async function getReservations(req, res) {
  const db = req.app.locals.db;
  const guestId = req.user.id;

  const [reservations] = await db.query(`
    SELECT
      i.id AS inquiry_id,
      i.status AS inquiry_status,
      i.rejection_reason,
      i.check_in,
      i.check_out,
      i.created_at,
      r.id AS reservation_id,
      r.status AS reservation_status,
      r.start_date AS res_start,
      r.end_date AS res_end,
      r.cancel_token,
      f.name AS facility_name,
      rm.name AS room_name,
      i.target_room_id
    FROM inquiries i
    LEFT JOIN reservations r ON r.inquiry_id = i.id
    LEFT JOIN rooms rm ON i.target_room_id = rm.id
    LEFT JOIN facilities f ON rm.facility_id = f.id
    WHERE i.guest_id = ?
    ORDER BY i.created_at DESC
  `, [guestId]);

  res.json(reservations);
}

async function updateReservationDates(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();
  const guestId = req.user.id;
  const inquiryId = req.params.inquiryId;
  const { check_in, check_out } = req.body;

  try {
    await connection.beginTransaction();

    if (!check_in || !check_out) {
      return sendError(res, 400, 'check_in and check_out are required');
    }

    // Validate ownership and allow modifications for "novo" or "obradjeno" statuses
    const [inquiry] = await connection.query(
      'SELECT * FROM inquiries WHERE id = ? AND guest_id = ? AND status IN (?, ?)',
      [inquiryId, guestId, 'novo', 'obradjeno']
    );

    if (inquiry.length === 0) {
      return sendError(res, 403, 'Reservation cannot be modified in its current state');
    }

    const originalInquiry = inquiry[0];

    // Check if modification deadline passed (7 days before check-in) - samo za "obradjeno"
    if (originalInquiry.status === 'obradjeno') {
      const { isAfterDays } = require('../utils/dateUtils');
      if (!isAfterDays(originalInquiry.check_in, 7)) {
        return sendError(res, 403, 'Cannot modify reservation less than 7 days before check-in');
      }
    }

    // Check for conflicting reservations (excluding current reservation)
    const [conflicts] = await connection.query(`
      SELECT id FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed') AND inquiry_id != ?
      AND (
        (start_date < ? AND end_date > ?) OR
        (start_date < ? AND end_date > ?) OR
        (start_date >= ? AND end_date <= ?)
      )
      LIMIT 1
    `, [originalInquiry.target_room_id, inquiryId, check_out, check_in,
        check_out, check_in, check_in, check_out]);

    if (conflicts.length > 0) {
      return sendError(res, 409, 'Room is not available for the new dates');
    }

    // Update inquiry dates
    await connection.query(
      'UPDATE inquiries SET check_in = ?, check_out = ? WHERE id = ?',
      [check_in, check_out, inquiryId]
    );

    // Keep status: ako je bilo "novo", ostaje "novo"; ako je "obradjeno", vraća se u "novo"
    let newStatus = originalInquiry.status;
    if (originalInquiry.status === 'obradjeno') {
      newStatus = 'novo';
      await connection.query(
        'UPDATE inquiries SET status = ? WHERE id = ?',
        ['novo', inquiryId]
      );
    }

    // Update reservation dates if exists
    await connection.query(
      'UPDATE reservations SET start_date = ?, end_date = ? WHERE inquiry_id = ?',
      [check_in, check_out, inquiryId]
    );

    await connection.commit();

    res.json({ 
      message: 'Reservation dates updated',
      check_in, 
      check_out,
      statusChanged: newStatus !== originalInquiry.status,
      newStatus: newStatus
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { guestLogin, getMe, redeemVoucher, changePassword, getReservations, updateReservationDates };
