'use strict';

const { planStay, suggestVisit } = require('../services/chatStayService');
const { createInquiryWithGuest } = require('../services/inquiryService');

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

/** Accommodation assistant: DB-backed planning (no live Anthropic call here). */
async function planStayChat(req, res) {
  const db = req.app.locals.db;
  const result = await planStay(db, req.body || {});
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
      check_in: body.check_in,
      check_out: body.check_out,
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

async function siteGuideTurn(req, res) {
  const { composeSiteGuideTurn } = require('../services/siteGuideService');
  const { validateAssistantTurn, makeFallbackAssistantTurn } = require('../services/assistantTurnSchema');
  const body = req.body || {};
  const message = String(body.message || '').trim();
  const lang = body.lang === 'en' ? 'en' : 'sr';

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const userKey = res.locals?.aiBudget?.userKey
    || (req.user?.id
      ? `admin:${req.user.id}`
      : (req.guest?.id
        ? `guest:${req.guest.id}`
        : `ip:${req.ip || 'unknown'}`));

  const turn = await composeSiteGuideTurn({ message, lang, userKey });

  try {
    validateAssistantTurn(turn);
  } catch (err) {
    console.error('[siteGuideTurn] invalid turn produced:', err.message);
    return res.status(200).json(makeFallbackAssistantTurn({ lang, reason: 'invalid_turn' }));
  }

  return res.status(200).json(turn);
}

module.exports = {
  planStayChat,
  suggestVisitChat,
  reserveStayChat,
  siteGuideTurn
};
