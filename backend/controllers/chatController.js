const { sendError } = require('../utils/response');
const { planStay, suggestVisit } = require('../services/chatStayService');
const { createInquiryWithGuest } = require('../services/inquiryService');
const aiService = require('../services/aiService');
const chatMetricsService = require('../services/chatMetricsService');
const { getForecastForUpcomingDays } = require('../services/weatherService');
const chatContextGuardService = require('../services/chatContextGuardService');

function getDestinationCoordinates() {
  const lat = Number(process.env.GOC_DESTINATION_LAT || process.env.WEATHER_LAT || 43.559095);
  const lon = Number(process.env.GOC_DESTINATION_LON || process.env.WEATHER_LON || 20.75393);
  return {
    lat: Number.isFinite(lat) ? lat : 43.559095,
    lon: Number.isFinite(lon) ? lon : 20.75393
  };
}

function getDestinationLabel() {
  return String(process.env.GOC_DESTINATION_LABEL || 'Nastavna baza Goc').trim();
}

function extractOriginFromMessage(message = '') {
  const source = String(message || '').trim();
  if (!source) return null;

  const lower = source.toLowerCase();
  const byPattern = [
    /od\s+([a-zA-Z\u0106\u0107\u0160\u0161\u017D\u017E\u0110\u0111\-\s]{2,60})$/i,
    /iz\s+([a-zA-Z\u0106\u0107\u0160\u0161\u017D\u017E\u0110\u0111\-\s]{2,60})$/i,
    /dolazim\s+iz\s+([a-zA-Z\u0106\u0107\u0160\u0161\u017D\u017E\u0110\u0111\-\s]{2,60})/i,
    /krecem\s+iz\s+([a-zA-Z\u0106\u0107\u0160\u0161\u017D\u017E\u0110\u0111\-\s]{2,60})/i
  ];

  for (const re of byPattern) {
    const m = source.match(re);
    if (m?.[1]) {
      const origin = m[1].replace(/[.,!?;:]+$/g, '').trim();
      if (origin.length >= 2) return origin;
    }
  }

  if (/^([a-zA-Z\u0106\u0107\u0160\u0161\u017D\u017E\u0110\u0111\-\s]{2,60})$/.test(source)
    && !/vreme|smestaj|rezervis|obilazak|noc|dan|odras|dece|deca|dete/i.test(lower)) {
    return source.trim();
  }

  return null;
}

function createGoogleMapsDirectionsLink(origin) {
  const destination = getDestinationCoordinates();
  const originEncoded = encodeURIComponent(String(origin || '').trim());
  const destinationEncoded = encodeURIComponent(`${destination.lat},${destination.lon}`);
  return `https://www.google.com/maps/dir/?api=1&origin=${originEncoded}&destination=${destinationEncoded}&travelmode=driving`;
}

function formatVisitSuggestionText(result = {}, userMessage = '') {
  const allSuggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
  if (!allSuggestions.length) {
    return 'Trenutno nemam predloge obilaska za taj upit, ali mogu predloziti smestaj i plan boravka.';
  }

  const source = String(userMessage || '').toLowerCase();
  const wantsFood = /kafana|restoran|gde\s+da\s+jedem|rucak|vecera/.test(source);

  const restaurants = allSuggestions.filter((item) => String(item?.type || '').toLowerCase() === 'restaurant');
  const nonRestaurants = allSuggestions.filter((item) => String(item?.type || '').toLowerCase() !== 'restaurant');

  const preferred = wantsFood
    ? [...restaurants, ...nonRestaurants]
    : [...nonRestaurants, ...restaurants];

  const top = preferred.slice(0, 4);
  const names = top.map((item) => item?.name).filter(Boolean);
  if (!names.length) {
    return 'Imam predloge obilaska i ugostiteljske ponude u blizini, pa mogu odmah da suzim po vasim interesovanjima.';
  }

  const weatherPart = result?.weather?.summary ? `${result.weather.summary} ` : '';
  return `${weatherPart}Predlog za obilazak u blizini: ${names.join(', ')}.`;
}

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

  const lockState = chatContextGuardService.checkLock(req);
  if (lockState.locked) {
    const lockResponse = {
      status: 'blocked',
      criteria: payload?.context || {},
      suggestions: [],
      alternatives: [],
      next_actions: [],
      assistant_message: lockState.message,
      assistant_provider_mode: 'context-guard',
      ai_contract: {
        version: '1.0',
        guard: {
          class: 'unsafe',
          reason: 'temporary_chat_cooldown'
        },
        intent: {
          name: 'unknown',
          confidence: 1
        },
        action: {
          name: 'none',
          params: {},
          requires_confirmation: false
        },
        reply: {
          text: lockState.message,
          style: 'friendly_concise'
        },
        source: 'context-guard'
      },
      chat_lock: {
        active: true,
        until: lockState.lockUntil,
        strikes: lockState.strikes
      }
    };

    chatMetricsService.recordPlanStayTurn({
      guardClass: 'unsafe',
      intentName: 'unknown',
      actionName: 'none',
      decisionSource: 'context-guard',
      assistantProviderMode: lockResponse.assistant_provider_mode,
      assistantText: lockResponse.assistant_message
    });

    return res.json(lockResponse);
  }

  const aiContract = await aiService.decideChatTurn({
    message: payload?.message || '',
    context: payload?.context || {},
    lang: 'sr'
  });

  if (aiContract?.guard?.class && aiContract.guard.class !== 'in_domain') {
    const outResult = aiContract?.guard?.class === 'out_of_domain'
      ? chatContextGuardService.registerOutOfDomain(req)
      : { locked: false, strikes: 0, message: null };

    const assistantMessage = outResult.message
      || aiContract?.reply?.text
      || 'Ovde sam za pitanja o smestaju i rezervaciji Nastavne baze Goc.';

    const blockedResponse = {
      status: 'blocked',
      criteria: payload?.context || {},
      suggestions: [],
      alternatives: [],
      next_actions: [],
      assistant_message: assistantMessage,
      assistant_provider_mode: aiContract?.source || 'heuristic',
      ai_contract: {
        ...aiContract,
        reply: {
          ...(aiContract?.reply || {}),
          text: assistantMessage
        }
      },
      chat_lock: outResult.locked
        ? {
          active: true,
          until: outResult.lockUntil,
          strikes: outResult.strikes
        }
        : {
          active: false,
          strikes: outResult.strikes
        }
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

  chatContextGuardService.registerInDomain(req);

  // Dispatcher: execute action defined by AI contract
  const actionName = aiContract?.action?.name || 'search_rooms';

  if (actionName === 'route_help') {
    const origin = extractOriginFromMessage(payload?.message || '');

    if (!origin) {
      const askRouteResponse = {
        status: 'needs_input',
        criteria: {
          ...(payload?.context || {}),
          pending_slot: 'route_origin'
        },
        suggestions: [],
        alternatives: [],
        next_actions: [
          'Kad stignemo rutu, mogu pomoci i oko smestaja.',
          'Ako dolazite samo u obilazak, mogu preporuciti aktivnosti na Gocu.'
        ],
        follow_up_question: 'Odakle dolazite? Poslacu vam najbrzu rutu do Nastavne baze Goc.',
        assistant_message: 'Naravno. Odakle dolazite? Poslacu vam Google Maps rutu do Nastavne baze Goc, pa mozemo odmah dalje na smestaj ili obilazak.',
        assistant_provider_mode: aiContract?.source || 'heuristic',
        ai_contract: aiContract
      };

      chatMetricsService.recordPlanStayTurn({
        guardClass: aiContract?.guard?.class,
        intentName: aiContract?.intent?.name,
        actionName: aiContract?.action?.name,
        decisionSource: aiContract?.source,
        assistantProviderMode: askRouteResponse.assistant_provider_mode,
        assistantText: askRouteResponse.assistant_message
      });

      return res.json(askRouteResponse);
    }

    const mapLink = createGoogleMapsDirectionsLink(origin);
    const destinationLabel = getDestinationLabel();
    const routeResponse = {
      status: 'needs_input',
      criteria: {
        ...(payload?.context || {}),
        pending_slot: null
      },
      suggestions: [],
      alternatives: [],
      next_actions: [
        'Ako zelite, mogu odmah da predlozim smestaj za vas termin.',
        'Ako ste za obilazak, mogu dati plan aktivnosti za dan/dva.'
      ],
      follow_up_question: 'Da li zelite da nastavimo ka rezervaciji smestaja ili samo obilasku Goca?',
      assistant_message: `Odlicno. Ruta od ${origin} do ${destinationLabel}: ${mapLink} Da li zelite da nastavimo ka rezervaciji smestaja ili samo obilasku Goca?`,
      assistant_provider_mode: aiContract?.source || 'heuristic',
      ai_contract: aiContract
    };

    chatMetricsService.recordPlanStayTurn({
      guardClass: aiContract?.guard?.class,
      intentName: aiContract?.intent?.name,
      actionName: aiContract?.action?.name,
      decisionSource: aiContract?.source,
      assistantProviderMode: routeResponse.assistant_provider_mode,
      assistantText: routeResponse.assistant_message
    });

    return res.json(routeResponse);
  }

  if (actionName === 'fetch_visits') {
    try {
      const visitResult = await suggestVisit(req.app.locals.db, {
        facility_id: payload?.context?.facility_id || null,
        check_in: payload?.context?.check_in || null,
        weather_mode: 'any',
        family: Number(payload?.context?.children || 0) > 0,
        lang: 'sr'
      });

      const lead = formatVisitSuggestionText(visitResult, payload?.message || '');
      const visitResponse = {
        status: 'needs_input',
        criteria: {
          ...(payload?.context || {}),
          pending_slot: null
        },
        suggestions: [],
        alternatives: [],
        visit_suggestions: Array.isArray(visitResult?.suggestions) ? visitResult.suggestions.slice(0, 6) : [],
        next_actions: [
          'Ako zelite, mogu odmah da predlozim smestaj prema terminu i broju osoba.',
          'Ako ostajete samo na obilasku, mogu suziti predloge po hrani, prirodi ili laganoj setnji.'
        ],
        follow_up_question: 'Da li zelite da nastavimo ka rezervaciji smestaja ili ostajemo na planu obilaska?',
        assistant_message: `${lead} Da li zelite da nastavimo ka rezervaciji smestaja ili ostajemo na planu obilaska?`,
        assistant_provider_mode: aiContract?.source || 'heuristic',
        ai_contract: aiContract
      };

      chatMetricsService.recordPlanStayTurn({
        guardClass: aiContract?.guard?.class,
        intentName: aiContract?.intent?.name,
        actionName: aiContract?.action?.name,
        decisionSource: aiContract?.source,
        assistantProviderMode: visitResponse.assistant_provider_mode,
        assistantText: visitResponse.assistant_message
      });

      return res.json(visitResponse);
    } catch {
      const fallbackVisitResponse = {
        status: 'needs_input',
        criteria: payload?.context || {},
        suggestions: [],
        alternatives: [],
        next_actions: [
          'Mogu odmah da pomognem oko smestaja i rezervacije.',
          'Mogu i da predlozim obilazak cim unesete zeljeni datum.'
        ],
        follow_up_question: 'Da li zelite da nastavimo na rezervaciju smestaja ili plan obilaska?',
        assistant_message: 'Trenutno ne mogu da ucitam predloge obilaska iz baze. Da li zelite da nastavimo na rezervaciju smestaja ili plan obilaska?',
        assistant_provider_mode: 'local-fallback',
        ai_contract: aiContract
      };

      chatMetricsService.recordPlanStayTurn({
        guardClass: aiContract?.guard?.class,
        intentName: aiContract?.intent?.name,
        actionName: aiContract?.action?.name,
        decisionSource: aiContract?.source,
        assistantProviderMode: fallbackVisitResponse.assistant_provider_mode,
        assistantText: fallbackVisitResponse.assistant_message
      });

      return res.json(fallbackVisitResponse);
    }
  }

  if (actionName === 'fetch_weather' && payload?.context?.check_in) {
    // Weather intent with date available — fetch forecast
    try {
      const bookingResult = await planStay(req.app.locals.db, payload);
      const suggestions = Array.isArray(bookingResult?.suggestions) ? bookingResult.suggestions : [];
      const firstFacilityId = suggestions[0]?.facility_id;

      let weatherSummary = 'Ne mogu da proverim vremensku prognozu za taj datum u ovom trenutku.';

      if (firstFacilityId) {
        const { suggestVisit } = require('../services/chatStayService');
        const visitResult = await suggestVisit(req.app.locals.db, {
          facility_id: firstFacilityId,
          check_in: payload?.context?.check_in,
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
        next_actions: [
          'Ako zelite, mogu odmah da nastavim sa rezervacijom smestaja.',
          'Ako dolazite samo u obilazak Goca, mogu predloziti plan obilaska.'
        ],
        follow_up_question: 'Da li zelite rezervaciju smestaja ili dolazite samo u obilazak Goca?',
        assistant_message: `${weatherSummary} Zelite li da nastavimo na rezervaciju smestaja ili plan obilaska?`,
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
      const errorResponse = {
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
        assistantProviderMode: errorResponse.assistant_provider_mode,
        assistantText: errorResponse.assistant_message
      });

      return res.json(errorResponse);
    }
  }

  // Weather action without date — ask for date instead of booking flow
  if (actionName === 'fetch_weather') {
    const userMessage = String(payload?.message || '').toLowerCase();
    const wantsGeneralTrend = /ovih dana|sledece nedelje|sljedece nedelje|next week|narednih dana/.test(userMessage);

    let trendText = '';
    if (wantsGeneralTrend) {
      try {
        const trend = await getForecastForUpcomingDays(7);
        if (trend?.available && trend?.summary) {
          trendText = `${trend.summary} `;
        }
      } catch {
        // Keep flow deterministic even if weather provider is unavailable.
      }
    }

    const weatherAskResponse = {
      status: 'needs_input',
      criteria: payload?.context || {},
      suggestions: [],
      alternatives: [],
      next_actions: [
        'Ako zelite rezervaciju, napisite termin, broj osoba i duzinu boravka.',
        'Ako dolazite samo u obilazak, mogu odmah predloziti aktivnosti na Gocu.'
      ],
      follow_up_question: 'Posaljite datum dolaska ili recite da li zelite smestaj ili samo obilazak.',
      assistant_message: `${trendText}Za tacnu prognozu potreban je datum dolaska. Posaljite datum ili recite da li zelite smestaj ili samo obilazak.`,
      assistant_provider_mode: aiContract?.source || 'heuristic',
      ai_contract: aiContract
    };

    chatMetricsService.recordPlanStayTurn({
      guardClass: aiContract?.guard?.class,
      intentName: aiContract?.intent?.name,
      actionName: aiContract?.action?.name,
      decisionSource: aiContract?.source,
      assistantProviderMode: weatherAskResponse.assistant_provider_mode,
      assistantText: weatherAskResponse.assistant_message
    });

    return res.json(weatherAskResponse);
  }

  // Default: search_rooms or other actions
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