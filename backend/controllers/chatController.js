'use strict';

const { createInquiryWithGuest } = require('../services/inquiryService');
const { askGemini }              = require('../services/geminiChatService');
const logger                     = require('../logger');

// ── Helpers ────────────────────────────────────────────────────────────────────

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

// ── reserve-stay ───────────────────────────────────────────────────────────────

/**
 * POST /api/chat/reserve-stay
 *
 * Creates a room inquiry from a chat conversation.
 *
 * Authenticated guest path  — uses token data; no name/email required.
 * Anonymous guest path      — requires sender_name, email, target_room_id,
 *                             check_in, check_out.
 *
 * Errors:
 *   400 — missing required fields
 *   409 — guest account already exists (login required) or room unavailable
 */
async function reserveStayChat(req, res) {
  const db   = req.app.locals.db;
  const body = req.body || {};

  if (!body.target_room_id || !body.check_in || !body.check_out) {
    return sendError(res, 400, 'target_room_id, check_in and check_out are required');
  }

  // ── Authenticated guest ──────────────────────────────────────────────────────
  if (req.user?.id) {
    const result = await createInquiryWithGuest(db, {
      guestId:                req.user.id,
      sender_name:            req.user.name,
      email:                  req.user.email,
      phone:                  body.phone,
      message:                body.message || 'Chat assistant reservation request',
      target_room_id:         body.target_room_id,
      check_in:               body.check_in,
      check_out:              body.check_out,
      board_type:             body.board_type || 'base',
      allowExistingGuestByEmail: true,
    });

    return res.json({
      status:    'created',
      message:   'Reservation inquiry created for the logged-in guest.',
      inquiryId: result.inquiryId,
      guest:     result.guest,
      newAccount: false,
    });
  }

  // ── Anonymous guest ──────────────────────────────────────────────────────────
  if (!body.sender_name || !body.email) {
    return sendError(res, 400, 'sender_name and email are required when guest is not logged in');
  }

  try {
    const result = await createInquiryWithGuest(db, {
      sender_name:            body.sender_name,
      email:                  body.email,
      phone:                  body.phone,
      message:                body.message || 'Chat assistant reservation request',
      target_room_id:         body.target_room_id,
      check_in:               body.check_in,
      check_out:              body.check_out,
      board_type:             body.board_type || 'base',
      allowExistingGuestByEmail: false,
    });

    return res.json({
      status:    'created',
      message:   result.newAccount
        ? 'Guest account and reservation inquiry created. Login details were sent by email.'
        : 'Reservation inquiry created successfully.',
      inquiryId: result.inquiryId,
      guest:     result.guest,
      newAccount: result.newAccount,
    });
  } catch (error) {
    if (error.code === 'LOGIN_REQUIRED') {
      return res.status(409).json({
        status:    'login_required',
        message:   'Guest account already exists. Please log in to continue the reservation.',
        next_step: 'guest_login',
      });
    }
    if (error.code === 'ROOM_UNAVAILABLE') {
      return res.status(409).json({
        status:  'unavailable',
        message: error.message,
      });
    }
    throw error;
  }
}

// ── fallback-chat ──────────────────────────────────────────────────────────────

/**
 * POST /api/chat/fallback
 *
 * Gemini Flash backup endpoint. The frontend calls this when the primary
 * streaming microservice (Render) is unreachable or returns an error.
 *
 * Body:
 *   message  {string}  — user message (required)
 *   history  {Array}   — recent [{role, content}] turns (optional, last 4)
 *   lang     {string}  — 'sr' | 'en', default 'sr'
 *
 * Response:
 *   { reply: string }
 */
async function fallbackChat(req, res) {
  const body    = req.body || {};
  const message = String(body.message || '').trim();
  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];

  if (!message) {
    return sendError(res, 400, 'message is required');
  }

  try {
    const reply = await askGemini(message, history);
    return res.json({ reply });
  } catch (err) {
    logger.error(`[fallbackChat] ${err.message}`);
    // Return a graceful soft error — do not expose the raw API error to the client
    return res.status(503).json({
      error: 'Fallback service is temporarily unavailable. Please try again shortly.',
    });
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = { reserveStayChat, fallbackChat };
