const bcrypt = require('bcryptjs');
const emailService = require('./emailService');
const { INQUIRY_STATUS } = require('../config/constants');

function createLoginRequiredError(message = 'Guest account already exists and login is required.') {
  const error = new Error(message);
  error.code = 'LOGIN_REQUIRED';
  return error;
}

async function sendEmailSafely(label, fn) {
  try {
    await fn();
  } catch (error) {
    console.warn(`[INQUIRY EMAIL] ${label} failed: ${error.message}`);
  }
}

async function resolveGuest(connection, options) {
  const {
    guestId,
    sender_name,
    email,
    allowExistingGuestByEmail = true
  } = options;

  if (guestId) {
    const [guests] = await connection.query(
      'SELECT id, name, email FROM guests WHERE id = ? LIMIT 1',
      [guestId]
    );

    if (guests.length === 0) {
      throw new Error('Guest account not found');
    }

    return {
      guest: guests[0],
      newAccount: false,
      existingGuestEmailNotice: false,
      temporaryPassword: null
    };
  }

  const [guests] = await connection.query(
    'SELECT id, name, email FROM guests WHERE email = ? LIMIT 1',
    [email]
  );

  if (guests.length > 0) {
    if (!allowExistingGuestByEmail) {
      throw createLoginRequiredError();
    }

    return {
      guest: guests[0],
      newAccount: false,
      existingGuestEmailNotice: true,
      temporaryPassword: null
    };
  }

  const temporaryPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
  const [result] = await connection.query(
    'INSERT INTO guests (name, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
    [sender_name, email, hashedPassword]
  );

  return {
    guest: {
      id: result.insertId,
      name: sender_name,
      email
    },
    newAccount: true,
    existingGuestEmailNotice: false,
    temporaryPassword
  };
}

async function createInquiryWithGuest(db, options) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      sender_name,
      email,
      phone,
      message,
      target_room_id,
      check_in,
      check_out
    } = options;

    const [conflicts] = await connection.query(
      `
      SELECT id FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed')
      AND (
        (start_date < ? AND end_date > ?) OR
        (start_date < ? AND end_date > ?) OR
        (start_date >= ? AND end_date <= ?)
      )
      LIMIT 1
      `,
      [target_room_id, check_out, check_in, check_out, check_in, check_in, check_out]
    );

    if (conflicts.length > 0) {
      const conflictError = new Error('Room is not available for the selected dates');
      conflictError.code = 'ROOM_UNAVAILABLE';
      throw conflictError;
    }

    const guestResolution = await resolveGuest(connection, options);
    const [inquiryResult] = await connection.query(
      `
      INSERT INTO inquiries (sender_name, email, phone, message, check_in, check_out, target_room_id, status, created_at, guest_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [
        sender_name || guestResolution.guest.name,
        email || guestResolution.guest.email,
        phone || null,
        message || null,
        check_in,
        check_out,
        target_room_id,
        INQUIRY_STATUS.NEW,
        guestResolution.guest.id
      ]
    );

    await connection.commit();

    if (guestResolution.newAccount) {
      await sendEmailSafely('sendGuestCreated', () => emailService.sendGuestCreated(guestResolution.guest.email, {
        name: guestResolution.guest.name,
        email: guestResolution.guest.email,
        password: guestResolution.temporaryPassword
      }));
    } else if (guestResolution.existingGuestEmailNotice) {
      await sendEmailSafely('sendGuestExists', () => emailService.sendGuestExists(guestResolution.guest.email, {
        name: guestResolution.guest.name
      }));
    }

    await sendEmailSafely('sendInquiryReceived', () => emailService.sendInquiryReceived(guestResolution.guest.email, {
      name: guestResolution.guest.name
    }));

    return {
      inquiryId: inquiryResult.insertId,
      newAccount: guestResolution.newAccount,
      guest: guestResolution.guest
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createInquiryWithGuest,
  createLoginRequiredError
};