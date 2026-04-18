const { sendError } = require('../utils/response');
const { planStay, suggestVisit } = require('../services/chatStayService');
const { createInquiryWithGuest } = require('../services/inquiryService');
const aiService = require('../services/aiService');

function getActionFromResult(result = {}) {
  if (result?.status === 'needs_input') {
    return {
      name: 'none',
      params: {},
      requires_confirmation: false
    };
  }

  if (Array.isArray(result?.suggestions) && result.suggestions.length > 0) {
    return {
      name: 'search_rooms',
      params: {
        suggestions_count: result.suggestions.length
      },
      requires_confirmation: false
    };
  }

  return {
    name: 'none',
    params: {},
    requires_confirmation: false
  };
}

async function attachAssistantMessage(payload, result) {
  try {
    const mode = result?.status === 'needs_input' ? 'needs_input' : 'suggestions';
    const aiReply = await aiService.composeChatReply({
      mode,
      lang: 'sr',
      userMessage: payload?.message || '',
      followUpQuestion: result?.follow_up_question || '',
      missing: result?.missing || {},
      criteria: result?.criteria || {},
      suggestions: result?.suggestions || []
    });

    if (aiReply?.text) {
      return {
        ...result,
        assistant_message: aiReply.text,
        assistant_provider_mode: aiReply.provider_mode || 'unknown'
      };
    }
  } catch {
    // Keep deterministic flow even if AI layer fails.
  }

  return result;
}

async function planStayChat(req, res) {
  const payload = req.body || {};
  const aiContract = await aiService.decideChatTurn({
    message: payload?.message || '',
    context: payload?.context || {},
    lang: 'sr'
  });

  if (aiContract?.guard?.class && aiContract.guard.class !== 'in_domain') {
    return res.json({
      status: 'blocked',
      criteria: payload?.context || {},
      suggestions: [],
      alternatives: [],
      next_actions: [],
      assistant_message: aiContract?.reply?.text || 'Ovde sam za pitanja o smestaju i rezervaciji Nastavne baze Goc.',
      assistant_provider_mode: aiContract?.source || 'heuristic',
      ai_contract: aiContract
    });
  }

  const result = await planStay(req.app.locals.db, payload);
  const response = await attachAssistantMessage(payload, result);
  return res.json({
    ...response,
    ai_contract: {
      ...(aiContract || {}),
      guard: {
        class: 'in_domain',
        reason: aiContract?.guard?.reason || 'accommodation_query'
      },
      action: getActionFromResult(response),
      reply: {
        text: response?.assistant_message || aiContract?.reply?.text || '',
        style: 'friendly_concise'
      }
    }
  });
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