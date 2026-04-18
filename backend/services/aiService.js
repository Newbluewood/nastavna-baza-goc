function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function sentenceCase(text) {
  if (!text) return '';
  const t = normalizeWhitespace(text);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function improveTone(text, lang) {
  const base = sentenceCase(text);
  if (!base) return '';

  if (lang === 'en') {
    return base
      .replace(/\bvery\s+very\b/gi, 'very')
      .replace(/\bnice\b/gi, 'comfortable')
      .replace(/\bgood\b/gi, 'well-suited');
  }

  return base
    .replace(/\bbas\b/gi, 'dobro')
    .replace(/\blep\b/gi, 'prijatan')
    .replace(/\bok\b/gi, 'odgovarajuci');
}

function createProofreadSuggestions(original, suggested) {
  const suggestions = [];
  if (normalizeWhitespace(original) !== original) {
    suggestions.push('Whitespace normalized');
  }
  if (suggested.length && suggested[0] !== original[0]) {
    suggestions.push('Capitalized sentence start');
  }
  if (!/[.!?]$/.test(suggested)) {
    suggestions.push('Missing terminal punctuation (optional)');
  }
  return suggestions;
}

function createRewriteSuggestions(original, suggested, tone) {
  const suggestions = [];
  if (normalizeWhitespace(original) !== normalizeWhitespace(suggested)) {
    suggestions.push(`Adjusted text for ${tone} tone`);
  }
  return suggestions;
}

function getSupportedProvider(provider) {
  return ['mock', 'anthropic'].includes(provider);
}

function truncateToWords(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return String(text || '').trim();
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function getLocalProofread(text) {
  const source = String(text || '');
  const suggested = sentenceCase(source);
  const maxOutputWords = Number.parseInt(process.env.AI_MAX_OUTPUT_WORDS || '80', 10);
  return {
    suggested_text: truncateToWords(suggested, maxOutputWords),
    notes: createProofreadSuggestions(source, suggested),
    provider_mode: 'local-fallback'
  };
}

function getLocalRewrite(text, { lang = 'sr', tone = 'professional' } = {}) {
  const source = String(text || '');
  const maxOutputWords = Number.parseInt(process.env.AI_MAX_OUTPUT_WORDS || '80', 10);

  let rewritten = source;
  if (tone === 'professional') {
    rewritten = improveTone(source, lang);
  } else if (tone === 'concise') {
    rewritten = sentenceCase(source).replace(/\b(zaista|really|very)\b/gi, '').replace(/\s+/g, ' ').trim();
  } else {
    rewritten = sentenceCase(source);
  }

  return {
    suggested_text: truncateToWords(rewritten, maxOutputWords),
    tone,
    notes: createRewriteSuggestions(source, rewritten, tone),
    provider_mode: 'local-fallback'
  };
}

function getChatMaxWords() {
  return Number.parseInt(process.env.AI_CHAT_MAX_WORDS || '55', 10);
}

function getChatMaxChars() {
  return Number.parseInt(process.env.AI_CHAT_MAX_CHARS || '420', 10);
}

function getChatMaxTokens() {
  return Number.parseInt(process.env.AI_CHAT_MAX_OUTPUT_TOKENS || '120', 10);
}

function getChatCacheTtlMs() {
  return Number.parseInt(process.env.AI_CHAT_CACHE_TTL_MS || '300000', 10);
}

function getChatCacheMaxEntries() {
  return Number.parseInt(process.env.AI_CHAT_CACHE_MAX_ENTRIES || '300', 10);
}

function truncateToChars(text, maxChars) {
  const source = String(text || '').trim();
  if (!source) return '';
  if (!Number.isFinite(Number(maxChars)) || Number(maxChars) <= 0) {
    return source;
  }

  const limit = Number(maxChars);
  if (source.length <= limit) {
    return source;
  }

  return `${source.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function shouldUseLiveIntent() {
  return String(process.env.AI_CHAT_USE_LIVE_INTENT || 'true').toLowerCase() === 'true';
}

const ALLOWED_INTENTS = new Set([
  'search_rooms',
  'weather',
  'route_help',
  'suggest_visit',
  'reserve_start',
  'faq',
  'smalltalk',
  'unknown'
]);

const ALLOWED_ACTIONS = new Set([
  'none',
  'search_rooms',
  'fetch_weather',
  'route_help',
  'fetch_visits',
  'open_inquiry_form',
  'redirect_login'
]);

const chatReplyCache = new Map();

function toJsonString(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

function parseJsonLoose(value) {
  if (!value) return null;
  const source = String(value).trim();
  if (!source) return null;

  try {
    return JSON.parse(source);
  } catch {
    const first = source.indexOf('{');
    const last = source.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(source.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeGuardClass(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'in_domain' || v === 'out_of_domain' || v === 'unsafe') return v;
  return 'in_domain';
}

function normalizeIntentName(value) {
  const v = String(value || '').toLowerCase();
  return ALLOWED_INTENTS.has(v) ? v : 'unknown';
}

function normalizeActionName(value) {
  const v = String(value || '').toLowerCase();
  return ALLOWED_ACTIONS.has(v) ? v : 'none';
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeEntities(entities = {}) {
  return {
    adults: safeNumber(entities.adults),
    children: safeNumber(entities.children),
    check_in: entities.check_in ? String(entities.check_in) : null,
    stay_length_days: safeNumber(entities.stay_length_days),
    facility_id: safeNumber(entities.facility_id),
    room_id: safeNumber(entities.room_id)
  };
}

function normalizeDecision(raw = {}, fallback = {}) {
  const normalized = {
    version: 'v1',
    guard: {
      class: normalizeGuardClass(raw?.guard?.class || fallback?.guard?.class),
      reason: String(raw?.guard?.reason || fallback?.guard?.reason || 'heuristic')
    },
    intent: {
      name: normalizeIntentName(raw?.intent?.name || fallback?.intent?.name),
      confidence: clampConfidence(raw?.intent?.confidence ?? fallback?.intent?.confidence)
    },
    entities: normalizeEntities(raw?.entities || fallback?.entities || {}),
    action: {
      name: normalizeActionName(raw?.action?.name || fallback?.action?.name),
      params: raw?.action?.params && typeof raw.action.params === 'object' ? raw.action.params : (fallback?.action?.params || {}),
      requires_confirmation: Boolean(raw?.action?.requires_confirmation ?? fallback?.action?.requires_confirmation)
    },
    reply: {
      text: String(raw?.reply?.text || fallback?.reply?.text || ''),
      style: 'friendly_concise'
    }
  };

  if (!normalized.reply.text) {
    normalized.reply.text = 'Mogu da pomognem oko smestaja i rezervacije na sajtu Nastavne baze Goc.';
  }

  normalized.reply.text = truncateToChars(
    truncateToWords(normalized.reply.text, getChatMaxWords()),
    getChatMaxChars()
  );
  return normalized;
}

function detectHeuristicDecision(message, context = {}) {
  const source = String(message || '').toLowerCase();
  const src = source.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const checkIn = context?.check_in ? String(context.check_in) : null;

  const isUnsafe = /ignore|zaobidji|zaobiđi|prompt|internal|system prompt|token|api key|lozink|password|hack|exploit|sql|drop table/.test(src);
  if (isUnsafe) {
    return normalizeDecision({
      guard: { class: 'unsafe', reason: 'policy_or_injection_attempt' },
      intent: { name: 'unknown', confidence: 0.98 },
      entities: {},
      action: { name: 'none', params: {}, requires_confirmation: false },
      reply: {
        text: 'Ne mogu da pomognem sa tim zahtevom. Ovde sam za pitanja o smestaju i rezervacijama Nastavne baze Goc.'
      }
    });
  }

  const outOfDomain = /python|javascript|react|node\.|c\+\+|java kod|napisi kod|write code|debug|algoritam|matematika|bitcoin|politika|sport|trading/.test(src);
  if (outOfDomain) {
    return normalizeDecision({
      guard: { class: 'out_of_domain', reason: 'outside_site_scope' },
      intent: { name: 'smalltalk', confidence: 0.88 },
      entities: {},
      action: { name: 'none', params: {}, requires_confirmation: false },
      reply: {
        text: 'E, brate, na sajtu si Nastavne baze Goc. Ovde sam za smestaj, termine i rezervacije.'
      }
    });
  }

  const entities = {
    adults: safeNumber(context?.adults),
    children: safeNumber(context?.children),
    check_in: checkIn,
    stay_length_days: safeNumber(context?.stay_length_days),
    facility_id: null,
    room_id: null
  };

  if (/vreme|prognoz|temperatur|kisa|sunce|weather/.test(src)) {
    return normalizeDecision({
      guard: { class: 'in_domain', reason: 'weather_query' },
      intent: { name: 'weather', confidence: 0.9 },
      entities,
      action: { name: 'fetch_weather', params: { check_in: checkIn }, requires_confirmation: false },
      reply: {
        text: checkIn
          ? 'Proveravam vremensku prognozu za taj datum.'
          : 'Mogu da proverim vreme cim unesete tacan datum dolaska.'
      }
    });
  }

  const routeRequested = /kako\s+da\s+stign|kako\s+da\s+dodjem|kako\s+do\s+goc|ruta|put\s+do|navigacij|google\s*maps|mapa|directions|route|odakle\s+da\s+krenem/.test(src);
  const pendingRoute = String(context?.pending_slot || '').toLowerCase() === 'route_origin';
  if (routeRequested || pendingRoute) {
    return normalizeDecision({
      guard: { class: 'in_domain', reason: 'route_query' },
      intent: { name: 'route_help', confidence: 0.9 },
      entities,
      action: { name: 'route_help', params: {}, requires_confirmation: false },
      reply: {
        text: 'Mogu da pomognem oko dolaska do Nastavne baze Goc. Napisite odakle dolazite.'
      }
    });
  }

  const visitRequested = /obilazak|aktivnost|aktivnosti|sta\s+obi[cć]|izlet|atrakcij|kafana|kafan|restoran|gde\s+da\s+jedem|rucak|vecera|sightseeing|visit/.test(src);
  if (visitRequested) {
    return normalizeDecision({
      guard: { class: 'in_domain', reason: 'visit_query' },
      intent: { name: 'suggest_visit', confidence: 0.88 },
      entities,
      action: { name: 'fetch_visits', params: {}, requires_confirmation: false },
      reply: {
        text: 'Mogu da predlozim aktivnosti i dobru restoransku ponudu na Gocu i u blizini.'
      }
    });
  }

  const reserveStart = /rezervis|booking|book|imam nalog|nemam nalog|upit|forma/.test(src);
  if (reserveStart) {
    return normalizeDecision({
      guard: { class: 'in_domain', reason: 'reservation_flow' },
      intent: { name: 'reserve_start', confidence: 0.8 },
      entities,
      action: { name: 'open_inquiry_form', params: {}, requires_confirmation: true },
      reply: {
        text: 'Vazeci tok rezervacije je kroz formu. Pomoci cu vam da je otvorimo sa prepopunjenim podacima kad su poznati.'
      }
    });
  }

  return normalizeDecision({
    guard: { class: 'in_domain', reason: 'accommodation_query' },
    intent: { name: 'search_rooms', confidence: 0.82 },
    entities,
    action: { name: 'search_rooms', params: {}, requires_confirmation: false },
    reply: {
      text: 'Razumem. Proveravam smestaj i predlazem najbolje opcije za vas upit.'
    }
  });
}

function createChatCacheKey(payload = {}) {
  const safeSuggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions.slice(0, 3).map((item) => `${item?.facility_name || ''}|${item?.room_name || ''}`)
    : [];

  const safeMissing = payload.missing && typeof payload.missing === 'object' ? payload.missing : {};
  const safeCriteria = payload.criteria && typeof payload.criteria === 'object'
    ? {
      adults: payload.criteria.adults || null,
      children: payload.criteria.children || null,
      check_in: payload.criteria.check_in || null,
      stay_length_days: payload.criteria.stay_length_days || null
    }
    : {};

  return JSON.stringify({
    mode: payload.mode || 'general',
    lang: payload.lang || 'sr',
    followUpQuestion: String(payload.followUpQuestion || ''),
    missing: safeMissing,
    criteria: safeCriteria,
    suggestions: safeSuggestions
  });
}

function getCachedChatReply(key) {
  const entry = chatReplyCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > getChatCacheTtlMs()) {
    chatReplyCache.delete(key);
    return null;
  }

  return entry.value;
}

function cacheChatReply(key, value) {
  chatReplyCache.set(key, {
    value,
    createdAt: Date.now()
  });

  const maxEntries = getChatCacheMaxEntries();
  if (chatReplyCache.size <= maxEntries) return;

  const firstKey = chatReplyCache.keys().next().value;
  if (firstKey) {
    chatReplyCache.delete(firstKey);
  }
}

function getLocalChatReply(payload = {}) {
  const {
    mode = 'general',
    lang = 'sr',
    followUpQuestion = '',
    missing = {},
    suggestions = []
  } = payload;

  const top = Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  const names = top
    .map((item) => `${item?.facility_name || ''} / ${item?.room_name || ''}`.trim())
    .filter(Boolean)
    .join('; ');

  if (mode === 'needs_input') {
    const text = followUpQuestion
      || (missing?.guest_breakdown
        ? 'Recite broj odraslih i dece.'
        : missing?.check_in
          ? 'Posaljite tacan datum dolaska.'
          : 'Koliko dana zelite da ostanete?');
    return truncateToWords(sentenceCase(text), getChatMaxWords());
  }

  if (mode === 'suggestions') {
    if (!names) {
      return truncateToWords('Nemam raspolozive opcije za trazeni termin, ali mogu da predlozim alternativne datume.', getChatMaxWords());
    }
    const text = lang === 'en'
      ? `I found options: ${names}. If you want, I can help you pick the best match.`
      : `Nasao sam opcije: ${names}. Ako zelite, mogu da vam pomognem da suzimo najbolji izbor.`;
    return truncateToWords(sentenceCase(text), getChatMaxWords());
  }

  return truncateToWords('Mogu da pomognem oko smestaja, termina i obilazaka. Recite sta vam je trenutno najbitnije.', getChatMaxWords());
}

class AIService {
  getStatus() {
    const enabledFlag = String(process.env.AI_ENABLED || 'false').toLowerCase() === 'true';
    const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    const apiKey = process.env.AI_API_KEY || '';

    if (!enabledFlag) {
      return {
        enabled: false,
        mode: 'disabled',
        provider: 'none',
        reason: 'AI feature flag is disabled'
      };
    }

    if (!getSupportedProvider(provider)) {
      return {
        enabled: false,
        mode: 'misconfigured',
        provider,
        reason: 'Unsupported AI_PROVIDER'
      };
    }

    if (provider === 'mock') {
      return {
        enabled: true,
        mode: 'demo',
        provider,
        reason: 'Demo provider active (no external billing)'
      };
    }

    if (!apiKey) {
      return {
        enabled: false,
        mode: 'misconfigured',
        provider,
        reason: 'Missing AI_API_KEY'
      };
    }

    return {
      enabled: true,
      mode: 'live',
      provider,
      reason: 'External provider configured'
    };
  }

  isEnabled() {
    return this.getStatus().enabled;
  }

  getModel() {
    return process.env.AI_MODEL || 'claude-sonnet-4-6';
  }

  getMaxOutputWords() {
    return Number.parseInt(process.env.AI_MAX_OUTPUT_WORDS || '80', 10);
  }

  getMaxOutputTokens() {
    return Number.parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '180', 10);
  }

  shouldUseLiveForNeedsInput() {
    return String(process.env.AI_CHAT_USE_LIVE_FOR_NEEDS_INPUT || 'false').toLowerCase() === 'true';
  }

  isChatAssistantEnabled() {
    const flag = String(process.env.AI_CHAT_ASSISTANT_ENABLED || 'true').toLowerCase() === 'true';
    return flag && this.isEnabled();
  }

  async decideChatTurn(payload = {}) {
    const message = String(payload?.message || '');
    const context = payload?.context || {};
    const lang = payload?.lang || 'sr';

    const heuristic = detectHeuristicDecision(message, context);

    if (!this.isChatAssistantEnabled() || !shouldUseLiveIntent()) {
      return {
        ...heuristic,
        source: 'heuristic'
      };
    }

    const status = this.getStatus();
    if (status.mode !== 'live' || status.provider !== 'anthropic') {
      return {
        ...heuristic,
        source: 'heuristic'
      };
    }

    try {
      const promptPayload = {
        message: String(message).slice(0, 280),
        context: {
          adults: context?.adults || null,
          children: context?.children || null,
          check_in: context?.check_in || null,
          stay_length_days: context?.stay_length_days || null,
          pending_slot: context?.pending_slot || null
        }
      };

      const response = await this.callAnthropic(
        `Classify this chat turn for a booking assistant. Return ONLY valid JSON with keys: version, guard, intent, entities, action, reply. guard.class must be one of in_domain,out_of_domain,unsafe. intent.name must be one of search_rooms,weather,route_help,suggest_visit,reserve_start,faq,smalltalk,unknown. action.name must be one of none,search_rooms,fetch_weather,route_help,fetch_visits,open_inquiry_form,redirect_login. Keep reply.text concise and under ${getChatMaxWords()} words in ${lang === 'en' ? 'English' : 'Serbian Latin'}.`,
        toJsonString(promptPayload),
        { maxTokens: 220 }
      );

      const parsed = parseJsonLoose(response);
      const normalized = normalizeDecision(parsed || {}, heuristic);
      return {
        ...normalized,
        source: 'live'
      };
    } catch {
      return {
        ...heuristic,
        source: 'heuristic'
      };
    }
  }

  async callAnthropic(systemPrompt, userText, options = {}) {
    const apiKey = process.env.AI_API_KEY;
    const maxTokens = Number.isFinite(Number(options.maxTokens))
      ? Number(options.maxTokens)
      : this.getMaxOutputTokens();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.getModel(),
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userText
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Anthropic request failed');
    }

    const text = Array.isArray(data?.content)
      ? data.content.filter((item) => item?.type === 'text').map((item) => item.text).join('\n').trim()
      : '';

    if (!text) {
      throw new Error('Anthropic returned empty text');
    }

    return truncateToWords(text, this.getMaxOutputWords());
  }

  async proofread(text, lang = 'sr') {
    const status = this.getStatus();
    const source = String(text || '');

    if (status.mode !== 'live' || status.provider !== 'anthropic') {
      return getLocalProofread(source);
    }

    try {
      const suggested = await this.callAnthropic(
        `You are a careful editorial assistant for a CMS. Language: ${lang}. Improve spelling, grammar, punctuation, and readability. Preserve the meaning, structure, and approximate length. Return only the revised text with no explanation or markdown. Keep the answer short and under ${this.getMaxOutputWords()} words.`,
        source
      );

      return {
        suggested_text: suggested,
        notes: createProofreadSuggestions(source, suggested),
        provider_mode: 'live'
      };
    } catch (error) {
      const fallback = getLocalProofread(source);
      return {
        ...fallback,
        notes: [...fallback.notes, `Live AI unavailable: ${error.message}`]
      };
    }
  }

  async rewrite(text, { lang = 'sr', tone = 'professional' } = {}) {
    const status = this.getStatus();
    const source = String(text || '');

    if (status.mode !== 'live' || status.provider !== 'anthropic') {
      return getLocalRewrite(source, { lang, tone });
    }

    try {
      const rewritten = await this.callAnthropic(
        `You are a content editor for a public-facing website. Language: ${lang}. Rewrite the provided text in a ${tone} tone. Keep the original meaning, avoid exaggeration, and return only the rewritten text with no markdown or explanation. Keep the answer short and under ${this.getMaxOutputWords()} words.`,
        source
      );

      return {
        suggested_text: rewritten,
        tone,
        notes: createRewriteSuggestions(source, rewritten, tone),
        provider_mode: 'live'
      };
    } catch (error) {
      const fallback = getLocalRewrite(source, { lang, tone });
      return {
        ...fallback,
        notes: [...(fallback.notes || []), `Live AI unavailable: ${error.message}`]
      };
    }
  }

  async composeChatReply(payload = {}) {
    const {
      mode = 'general',
      lang = 'sr',
      userMessage = '',
      followUpQuestion = '',
      missing = {},
      suggestions = [],
      criteria = {}
    } = payload;

    const fallbackText = getLocalChatReply({
      mode,
      lang,
      followUpQuestion,
      missing,
      suggestions
    });

    if (!this.isChatAssistantEnabled()) {
      return {
        text: fallbackText,
        provider_mode: 'local-fallback'
      };
    }

    if (mode === 'needs_input' && !this.shouldUseLiveForNeedsInput()) {
      return {
        text: fallbackText,
        provider_mode: 'local-fallback'
      };
    }

    const cacheKey = createChatCacheKey(payload);
    const cached = getCachedChatReply(cacheKey);
    if (cached) {
      return {
        ...cached,
        provider_mode: `${cached.provider_mode || 'unknown'}-cache`
      };
    }

    const status = this.getStatus();
    if (status.mode !== 'live' || status.provider !== 'anthropic') {
      return {
        text: fallbackText,
        provider_mode: 'local-fallback'
      };
    }

    const compactFacts = {
      mode,
      follow_up_question: followUpQuestion || null,
      missing,
      criteria: {
        adults: criteria?.adults || null,
        children: criteria?.children || null,
        check_in: criteria?.check_in || null,
        stay_length_days: criteria?.stay_length_days || null
      },
      suggestions: Array.isArray(suggestions)
        ? suggestions.slice(0, 3).map((item) => ({
          facility_name: item?.facility_name,
          room_name: item?.room_name,
          rationale: Array.isArray(item?.rationale) ? item.rationale.slice(0, 2) : []
        }))
        : []
    };

    try {
      const reply = await this.callAnthropic(
        `You are a concise booking assistant for Nastavna baza Goc. Reply in ${lang === 'en' ? 'English' : 'Serbian (Latin script)'} naturally and politely. Keep the answer under ${getChatMaxWords()} words. Never invent availability or dates; use only provided facts. Ask at most one question. Avoid repetition and robotic phrasing. Always gently steer user to site-related topics (smestaj, rezervacija, dolazak, aktivnosti). Return only plain text.`,
        `User message: ${String(userMessage || '').slice(0, 220)}\nFacts: ${JSON.stringify(compactFacts)}`,
        { maxTokens: getChatMaxTokens() }
      );

      const liveResult = {
        text: truncateToChars(truncateToWords(reply, getChatMaxWords()), getChatMaxChars()),
        provider_mode: 'live'
      };

      cacheChatReply(cacheKey, liveResult);

      return liveResult;
    } catch (error) {
      const fallbackResult = {
        text: fallbackText,
        provider_mode: 'local-fallback',
        notes: [`Live AI unavailable: ${error.message}`]
      };

      cacheChatReply(cacheKey, fallbackResult);
      return fallbackResult;
    }
  }
}

module.exports = new AIService();
