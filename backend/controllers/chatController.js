const { sendError } = require('../utils/response');
const { planStay, suggestVisit } = require('../services/chatStayService');
const { createInquiryWithGuest } = require('../services/inquiryService');

async function planStayChat(req, res) {
  const result = await planStay(req.app.locals.db, req.body || {});
  return res.json(result);
}

async function suggestVisitChat(req, res) {
  const result = await suggestVisit(req.app.locals.db, req.body || {});
  return res.json(result);
}

async function reserveStayChat(req, res) {
  const db = req.app.locals.db;
  const body = req.body || {};

  if (!body.target_room_id || !body.check_in || !body.check_out) {
    return sendError(res, 400, 'target_room_id, check_in and check_out are required');
  }

  if (req.user?.id) {
    const result = await createInquiryWithGuest(db, {
      guestId: req.user.id,
      sender_name: req.user.name,
      email: req.user.email,
      phone: body.phone,
      message: body.message || 'Chat assistant reservation request',
      target_room_id: body.target_room_id,
      check_in: body.check_in,
      check_out: body.check_out,
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
      check_in: body.check_in,
      check_out: body.check_out,
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
  planStayChat,
  suggestVisitChat,
  reserveStayChat
};