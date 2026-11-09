'use strict';

const { createInquiryWithGuest } = require('../services/inquiryService');

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

async function reserveStayChat(req, res) {
  const db = req.app.locals.db;
  const body = req.body || {};
  console.log('📥 [BACKEND] RECEIVED RESERVE REQUEST:', JSON.stringify(body, null, 2));

  // Simple date sanitizer to ensure YYYY-MM-DD
  const sanitizeDate = (d) => {
    if (!d) return d;
    // If it's DD.MM.YYYY
    if (d.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [dd, mm, yyyy] = d.split('.');
      return `${yyyy}-${mm}-${dd}`;
    }
    // If it's DD/MM/YYYY
    if (d.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [dd, mm, yyyy] = d.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    return d;
  };

  const check_in = sanitizeDate(body.check_in);
  const check_out = sanitizeDate(body.check_out);

  if (!check_in || !check_out) {
    return sendError(res, 400, 'check_in and check_out are required');
  }

  if (req.user?.id) {
    const result = await createInquiryWithGuest(db, {
      guestId: req.user.id,
      sender_name: req.user.name,
      email: req.user.email,
      phone: body.phone,
      message: body.message || 'Chat assistant reservation request',
      target_room_id: body.target_room_id,
      check_in: check_in,
      check_out: check_out,
      board_type: body.board_type || 'base',
      allowExistingGuestByEmail: true
    });

    return res.json({
      status: 'created',
      message: 'Reservation inquiry created for the logged-in guest.',
      inquiryId: result.inquiryId,
      guest: result.guest,
      newAccount: false
    });
  }

  if (!body.sender_name || !body.email) {
    return sendError(res, 400, 'sender_name and email are required when guest is not logged in');
  }

  try {
    const result = await createInquiryWithGuest(db, {
      sender_name: body.sender_name,
      email: body.email,
      phone: body.phone,
      message: body.message || 'Chat assistant reservation request',
      target_room_id: body.target_room_id,
      check_in: check_in,
      check_out: check_out,
      board_type: body.board_type || 'base',
      allowExistingGuestByEmail: false
    });

    return res.json({
      status: 'created',
      message: result.newAccount
        ? 'Guest account and reservation inquiry created. Login details were sent by email.'
        : 'Reservation inquiry created successfully.',
      inquiryId: result.inquiryId,
      guest: result.guest,
      newAccount: result.newAccount
    });
  } catch (error) {
    if (error.code === 'LOGIN_REQUIRED') {
      return res.status(409).json({
        status: 'login_required',
        message: 'Guest account already exists. Please log in to continue the reservation.',
        next_step: 'guest_login'
      });
    }

    if (error.code === 'ROOM_UNAVAILABLE') {
      return res.status(409).json({
        status: 'unavailable',
        message: error.message
      });
    }

    throw error;
  }
}

module.exports = {
  reserveStayChat
};
