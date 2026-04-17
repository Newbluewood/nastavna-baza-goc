const { isAfterDays, formatDate } = require('../utils/dateUtils');
const emailService = require('../services/emailService');
const { sendError } = require('../utils/response');

async function getCancelInfo(req, res) {
  const db = req.app.locals.db;
  const token = req.params.token;

  const [reservations] = await db.query(`
    SELECT r.*, i.check_in, i.check_out, g.name, g.email,
           f.name as facility, rm.name as room
    FROM reservations r
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN guests g ON i.guest_id = g.id
    JOIN rooms rm ON i.target_room_id = rm.id
    JOIN facilities f ON rm.facility_id = f.id
    WHERE r.cancel_token = ? AND r.status = 'confirmed'
  `, [token]);

  if (reservations.length === 0) {
    return sendError(res, 404, 'Invalid or expired cancel token');
  }

  const reservation = reservations[0];

  if (!isAfterDays(reservation.check_in, 7)) {
    return res.status(400).json({
      error: 'Cancellation not allowed. Must be at least 7 days before check-in.',
      checkIn: formatDate(reservation.check_in)
    });
  }

  res.json({
    reservation: {
      id: reservation.id,
      facility: reservation.facility,
      room: reservation.room,
      checkIn: formatDate(reservation.check_in),
      checkOut: formatDate(reservation.check_out),
      guestName: reservation.name
    },
    canCancel: true
  });
}

async function cancelReservation(req, res) {
  const db = req.app.locals.db;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const token = req.params.token;

    const [reservations] = await connection.query(`
      SELECT r.*, i.check_in, i.check_out, g.name, g.email,
             f.name as facility, rm.name as room
      FROM reservations r
      JOIN inquiries i ON r.inquiry_id = i.id
      JOIN guests g ON i.guest_id = g.id
      JOIN rooms rm ON i.target_room_id = rm.id
      JOIN facilities f ON rm.facility_id = f.id
      WHERE r.cancel_token = ? AND r.status = 'confirmed'
    `, [token]);

    if (reservations.length === 0) {
      return sendError(res, 404, 'Invalid or expired cancel token');
    }

    const reservation = reservations[0];

    if (!isAfterDays(reservation.check_in, 7)) {
      return sendError(res, 400, 'Cancellation not allowed. Must be at least 7 days before check-in.');
    }

    await connection.query(
      "UPDATE reservations SET status = 'cancelled' WHERE id = ?",
      [reservation.id]
    );

    await connection.query(
      "UPDATE inquiries SET status = 'otkazano' WHERE id = ?",
      [reservation.inquiry_id]
    );

    await connection.commit();

    if (reservation.email) {
      try {
        await emailService.sendCancelConfirmed(reservation.email, {
          name: reservation.name,
          facility: reservation.facility,
          room: reservation.room,
          checkIn: reservation.check_in,
          checkOut: reservation.check_out
        });
      } catch (emailErr) {
        console.warn('Cancellation email delivery failed:', emailErr.message);
      }
    }

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { getCancelInfo, cancelReservation };
