const { sendError } = require('../utils/response');
const { planStay, suggestVisit } = require('../services/chatStayService');
const { createInquiryWithGuest } = require('../services/inquiryService');
const aiService = require('../services/aiService');
const chatMetricsService = require('../services/chatMetricsService');

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
    const blockedResponse = {
      status: 'blocked',
      criteria: payload?.context || {},
      suggestions: [],
      alternatives: [],
      next_actions: [],
      assistant_message: aiContract?.reply?.text || 'Ovde sam za pitanja o smestaju i rezervaciji Nastavne baze Goc.',
      assistant_provider_mode: aiContract?.source || 'heuristic',
      ai_contract: aiContract
    };

    chatMetricsService.recordPlanStayTurn({
      guardClass: aiContract?.guard?.class,
      intentName: aiContract?.intent?.name,
      actionName: aiContract?.action?.name,
      decisionSource: aiContract?.source,
      assistantProviderMode: blockedResponse.assistant_provider_mode,
      assistantText: blockedResponse.assistant_message
    });

    return res.json(blockedResponse);
  }

  // Check intent — if it's a special case (weather), handle separately
  const intentName = aiContract?.intent?.name || 'unknown';
  
  if (intentName === 'weather') {
    const checkIn = payload?.context?.check_in;
    
    // If we don't have check_in date yet, ask for it
    if (!checkIn) {
      const weatherResponse = {
        status: 'needs_input',
        criteria: payload?.context || {},
        suggestions: [],
        alternatives: [],
        next_actions: [],
        follow_up_question: aiContract?.reply?.text || 'Za vremensku prognozu trebam tacan datum dolaska.',
        assistant_message: aiContract?.reply?.text || 'Mogu da proverim vremensku prognozu.',
        assistant_provider_mode: aiContract?.source || 'heuristic',
        ai_contract: aiContract
      };

      chatMetricsService.recordPlanStayTurn({
        guardClass: aiContract?.guard?.class,
        intentName: aiContract?.intent?.name,
        actionName: aiContract?.action?.name,
        decisionSource: aiContract?.source,
        assistantProviderMode: weatherResponse.assistant_provider_mode,
        assistantText: weatherResponse.assistant_message
      });

      return res.json(weatherResponse);
    }

    // We have check_in, so try to fetch weather for a facility
    try {
      // First get facility suggestions to know which facility to check weather for
      const bookingResult = await planStay(req.app.locals.db, payload);
      const suggestions = Array.isArray(bookingResult?.suggestions) ? bookingResult.suggestions : [];
      const firstFacilityId = suggestions[0]?.facility_id;

      let weatherSummary = 'Ne mogu da proverim vremensku prognozu za taj datum u ovom trenutku.';

      if (firstFacilityId) {
        // Fetch weather for the recommended facility
        const { suggestVisit } = require('../services/chatStayService');
        const visitResult = await suggestVisit(req.app.locals.db, {
          facility_id: firstFacilityId,
          check_in: checkIn,
          weather_mode: 'any',
          family: Number(payload?.context?.children || 0) > 0,
          lang: 'sr'
        });

        if (visitResult?.weather?.summary) {
          weatherSummary = visitResult.weather.summary;
        }
      }

      const weatherResponse = {
        status: 'needs_input',
        criteria: payload?.context || {},
        suggestions: [],
        alternatives: [],
        next_actions: [],
        follow_up_question: weatherSummary,
        assistant_message: weatherSummary,
        assistant_provider_mode: aiContract?.source || 'heuristic',
        ai_contract: aiContract
      };

      chatMetricsService.recordPlanStayTurn({
        guardClass: aiContract?.guard?.class,
        intentName: aiContract?.intent?.name,
        actionName: aiContract?.action?.name,
        decisionSource: aiContract?.source,
        assistantProviderMode: weatherResponse.assistant_provider_mode,
        assistantText: weatherResponse.assistant_message
      });

      return res.json(weatherResponse);
    } catch (error) {
      const weatherResponse = {
        status: 'needs_input',
        criteria: payload?.context || {},
        suggestions: [],
        alternatives: [],
        next_actions: [],
        follow_up_question: 'Ne mogu da proverim vremensku prognozu. Pokušajte ponovo ili nastavite sa rezervacijom.',
        assistant_message: 'Ne mogu da proverim vremensku prognozu. Pokušajte ponovo ili nastavite sa rezervacijom.',
        assistant_provider_mode: 'local-fallback',
        ai_contract: aiContract
      };

      chatMetricsService.recordPlanStayTurn({
        guardClass: aiContract?.guard?.class,
        intentName: aiContract?.intent?.name,
        actionName: aiContract?.action?.name,
        decisionSource: aiContract?.source,
        assistantProviderMode: weatherResponse.assistant_provider_mode,
        assistantText: weatherResponse.assistant_message
      });

      return res.json(weatherResponse);
    }
  }

  // Normal booking flow
  const result = await planStay(req.app.locals.db, payload);
  const response = await attachAssistantMessage(payload, result);
  const finalResponse = {
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
  };

  chatMetricsService.recordPlanStayTurn({
    guardClass: finalResponse?.ai_contract?.guard?.class,
    intentName: finalResponse?.ai_contract?.intent?.name,
    actionName: finalResponse?.ai_contract?.action?.name,
    decisionSource: aiContract?.source,
    assistantProviderMode: finalResponse?.assistant_provider_mode,
    assistantText: finalResponse?.assistant_message
  });

  return res.json(finalResponse);
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