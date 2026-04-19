const { sendError } = require('../utils/response');
const { planStay, suggestVisit } = require('../services/chatStayService');
const { createInquiryWithGuest } = require('../services/inquiryService');
const aiService = require('../services/aiService');
const chatMetricsService = require('../services/chatMetricsService');
const chatContextGuardService = require('../services/chatContextGuardService');

async function planStayChat(req, res) {
  const payload = req.body || {};
  const userMessage = String(payload?.message || '').trim();

  if (!userMessage) {
    return sendError(res, 400, 'Message is required');
  }

  // 1. Safety check (heuristic — no tokens spent)
  const safety = aiService.checkMessageSafety(userMessage);
  if (safety.class === 'unsafe') {
    chatMetricsService.recordPlanStayTurn({
      guardClass: 'unsafe',
      intentName: 'unknown',
      actionName: 'none',
      decisionSource: 'guard',
      assistantProviderMode: 'guard',
      assistantText: ''
    });

    return res.json({
      status: 'blocked',
      assistant_message: 'Не могу да помогнем са тим захтевом. Питајте ме о смештају, активностима или ресторану на Гочу.',
      assistant_provider_mode: 'guard',
      criteria: payload?.context || {},
      suggestions: [],
      alternatives: []
    });
  }

  // 2. Soft guard tracking (no lockout, just metrics)
  const guardState = chatContextGuardService.check(req, safety.class);

  // 3. Get room/booking data — planStay handles entity parsing internally
  //    This is cheap when booking context is incomplete (just parsing, no DB query)
  let roomResults = null;
  try {
    roomResults = await planStay(req.app.locals.db, payload);
  } catch {
    // DB unavailable — continue without room data
  }

  // 4. AI response with RAG context (facts from docs + room results)
  const aiResult = await aiService.composeChatReply({
    message: userMessage,
    context: payload?.context || {},
    roomResults,
    history: payload?.history || [],
    lang: 'sr'
  });

  // 5. Append gentle OOD reminder if needed
  let assistantMessage = aiResult.text;
  if (safety.class === 'out_of_domain' && guardState.reminder) {
    assistantMessage += `\n\n${guardState.reminder}`;
  }

  // 6. Record metrics
  chatMetricsService.recordPlanStayTurn({
    guardClass: safety.class,
    intentName: 'chat',
    actionName: roomResults?.suggestions?.length ? 'search_rooms' : 'none',
    decisionSource: aiResult.provider_mode,
    assistantProviderMode: aiResult.provider_mode,
    assistantText: assistantMessage
  });

  // 7. Response
  const status = roomResults?.suggestions?.length
    ? 'suggestions'
    : roomResults?.status === 'needs_input'
      ? 'needs_input'
      : 'ai_response';

  return res.json({
    status,
    assistant_message: assistantMessage,
    assistant_provider_mode: aiResult.provider_mode,
    criteria: roomResults?.criteria || payload?.context || {},
    suggestions: roomResults?.suggestions || [],
    alternatives: roomResults?.alternatives || []
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
