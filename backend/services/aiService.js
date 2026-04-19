const fs = require('fs');
const path = require('path');

// ─── Text Utility Functions (admin proofread / rewrite) ───

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

function truncateToChars(text, maxChars) {
  const source = String(text || '').trim();
  if (!source || !Number.isFinite(Number(maxChars)) || Number(maxChars) <= 0) return source;
  if (source.length <= Number(maxChars)) return source;
  return `${source.slice(0, Math.max(0, Number(maxChars) - 3)).trim()}...`;
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

// ─── Chat Configuration ───

function getChatMaxTokens() {
  return Number.parseInt(process.env.AI_CHAT_MAX_OUTPUT_TOKENS || '200', 10);
}

function getChatCacheTtlMs() {
  return Number.parseInt(process.env.AI_CHAT_CACHE_TTL_MS || '300000', 10);
}

function getChatCacheMaxEntries() {
  return Number.parseInt(process.env.AI_CHAT_CACHE_MAX_ENTRIES || '300', 10);
}

// ─── Docs Cache (RAG Knowledge Base) ───

let cachedFacts = null;

function loadDocsCache() {
  if (cachedFacts) return cachedFacts;

  const docsDir = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsDir)) {
    cachedFacts = [];
    return cachedFacts;
  }

  const facts = [];
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(docsDir, file), 'utf8'));
      const topic = file.replace('.json', '');

      for (const [key, val] of Object.entries(data)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === 'object') {
              facts.push({ ...item, _topic: topic, _section: key });
            }
          }
        } else if (val && typeof val === 'object') {
          // Handle nested structures (e.g. meni with subcategories)
          const hasNestedArrays = Object.values(val).some(v => Array.isArray(v));
          if (hasNestedArrays) {
            for (const [subKey, subVal] of Object.entries(val)) {
              if (Array.isArray(subVal)) {
                for (const item of subVal) {
                  if (item && typeof item === 'object') {
                    facts.push({ ...item, _topic: topic, _section: `${key}.${subKey}` });
                  }
                }
              }
            }
          } else {
            facts.push({ ...val, _topic: topic, _section: key });
          }
        }
      }
    } catch { /* skip broken files */ }
  }

  cachedFacts = facts;
  return cachedFacts;
}

// ─── Topic Filtering ───

const TOPIC_PATTERNS = [
  { topic: 'piramida-meni', regex: /hran|jelo|meni|restoran|kafan|rucak|vecer|dorucak|obrok|pic[ea]|desert|predjel|sup[ae]|corb|specijalitet|kaf[aeu]|sok|pivo|vino|rakij|klop/i },
  { topic: 'atractions', regex: /atrakcij|obilazak|izlet|setn|planinar|staz|vidikovac|livad|sport|rekreacij|prirod|ski|edukacij|aktivnost|tura|bicikl/i },
  { topic: 'events', regex: /dogadjaj|manifestacij|desavanj|kamp|skol|takmicenj|festival|maraton|program/i },
  { topic: 'faq', regex: /pravil|pitanj|odgovor|faq|registracij|otkazivanj|placanj|parking|wifi|kucni\s*red|check.?in|check.?out/i },
  { topic: 'prices', regex: /cen[ae]|cenovnik|kost|placanj|dinar|rsd|nocenj|tarif/i },
  { topic: 'contacts', regex: /kontakt|telefon|mejl|email|adres|lokacij|kako.*doc|gde.*nalaz|broj/i }
];

function filterFactsByRelevance(message, allFacts, maxFacts = 15) {
  const msg = String(message || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const matchedTopics = new Set();
  for (const { topic, regex } of TOPIC_PATTERNS) {
    if (regex.test(msg)) matchedTopics.add(topic);
  }

  // No specific topic → return overview (first 2 from each topic)
  if (matchedTopics.size === 0) {
    const byTopic = {};
    for (const fact of allFacts) {
      const t = fact._topic || 'other';
      if (!byTopic[t]) byTopic[t] = [];
      if (byTopic[t].length < 2) byTopic[t].push(fact);
    }
    return Object.values(byTopic).flat().slice(0, maxFacts);
  }

  // Filter facts by matched topics
  const relevant = allFacts.filter(f => matchedTopics.has(f._topic));
  if (relevant.length > 0) return relevant.slice(0, maxFacts);

  // Fallback: keyword match in fact content
  const words = msg.split(/\s+/).filter(w => w.length > 3);
  const byKeyword = allFacts.filter(f => {
    const text = JSON.stringify(f).toLowerCase();
    return words.some(w => text.includes(w));
  });
  return byKeyword.slice(0, maxFacts);
}

// ─── Safety Check (Heuristic) ───

function checkMessageSafety(message) {
  const src = String(message || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/ignore|zaobidji|prompt|internal|system\s*prompt|token|api\s*key|lozink|password|hack|exploit|sql|drop\s*table|injection|virus|malware|trojan|botnet|phish|keylog|ransomware|ddos/.test(src)) {
    return { safe: false, class: 'unsafe', reason: 'policy_violation' };
  }

  if (/\b(python|javascript|react|node\.|c\+\+|java\s+kod|napisi\s+kod|write\s+code|debug|algoritam|bitcoin|politika|predsednik|trading|fudbal|kosarka|recept|kuvanje|homework|zadatak\s+iz)\b/.test(src)) {
    return { safe: true, class: 'out_of_domain', reason: 'outside_scope' };
  }

  return { safe: true, class: 'in_domain', reason: 'ok' };
}

// ─── Response Cache ───

const chatReplyCache = new Map();

function getCacheKey(message, context) {
  return JSON.stringify({
    msg: String(message || '').trim().toLowerCase().slice(0, 200),
    adults: context?.adults || null,
    children: context?.children || null,
    check_in: context?.check_in || null,
    stay_length_days: context?.stay_length_days || null
  });
}

function getCachedReply(key) {
  const entry = chatReplyCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > getChatCacheTtlMs()) {
    chatReplyCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheReply(key, value) {
  chatReplyCache.set(key, { value, createdAt: Date.now() });
  if (chatReplyCache.size > getChatCacheMaxEntries()) {
    const firstKey = chatReplyCache.keys().next().value;
    if (firstKey) chatReplyCache.delete(firstKey);
  }
}

// ─── Prompt Builder ───

function buildSystemPrompt(lang = 'sr') {
  const isSr = lang !== 'en';
  return isSr
    ? [
      'Ti si prijateljski asistent za Nastavnu bazu Goč — planinsku bazu za odmor, edukaciju i rekreaciju na planini Goč kod Vrnjačke Banje.',
      '',
      'PRAVILA:',
      '- Imaš pristup ŽIVIM podacima o slobodnim sobama i cenama. Koristi ih!',
      '- Ako korisnik traži smeštaj, a nedostaju mu podaci (broj osoba, datum, dužina boravka) — pitaj ga prirodno za podatak koji nedostaje. NE šalji ga na telefon ili mejl.',
      '- Ako su u kontekstu navedene slobodne sobe — obavezno ih pomeni i ponudi opcije.',
      '- Ako korisnik pita o cenama, daj konkretne cifre iz konteksta (cene noćenja, hrane, aktivnosti).',
      '- Ako korisnik pita o hrani/meniju, prikaži konkretna jela i cene iz konteksta.',
      '- Ako korisnik pita o aktivnostima, opisuj atrakcije iz konteksta.',
      '- Budi prirodan, prijateljski i sažet (do 80 reči).',
      '- Ako nemaš podatke za pitanje, reci iskreno.',
      '- Piši na srpskom latiničnom pismu.',
      '- Odgovaraj kao čovek, ne kao robot.',
      '- NIKAD ne reci korisniku da "nemaš real-time informacije" — ti ih IMAŠ u kontekstu.'
    ].join('\n')
    : [
      'You are a friendly assistant for Nastavna Baza Goč — a mountain lodge for rest, education and recreation on Goč mountain near Vrnjačka Banja, Serbia.',
      '',
      'RULES:',
      '- You have access to LIVE room availability and pricing data. Use it!',
      '- If the user asks about accommodation but is missing info (guest count, dates, stay length) — ask naturally for what is missing. Do NOT send them to phone or email.',
      '- If available rooms are in the context — mention them and offer options.',
      '- If the user asks about prices, give concrete numbers from the context.',
      '- Be natural, friendly and concise (under 80 words).',
      '- If you lack data for a question, say so honestly.',
      '- Write in English.',
      '- Sound human, not robotic.',
      '- NEVER tell the user you lack real-time info — you DO have it in the context.'
    ].join('\n');
}

function formatFactForPrompt(fact) {
  const clean = { ...fact };
  delete clean._topic;
  delete clean._section;
  return JSON.stringify(clean);
}

function buildUserPrompt(message, facts, roomResults, context, history) {
  const parts = [];

  if (facts.length > 0) {
    const factsStr = facts
      .map((f, i) => `${i + 1}. ${formatFactForPrompt(f)}`)
      .join('\n');
    parts.push(`Podaci iz baze:\n${factsStr}`);
  }

  if (roomResults?.suggestions?.length > 0) {
    const rooms = roomResults.suggestions.map(s =>
      `- ${s.facility_name} / ${s.room_name} (kapacitet: ${s.capacity_label || '?'}, ${s.is_recommended ? 'PREPORUČENO' : 'dostupno'})`
    ).join('\n');
    parts.push(`SLOBODNE SOBE za traženi termin (ŽIVI podaci iz baze):\n${rooms}\nOve sobe su stvarno slobodne — pomeni ih korisniku.`);
  } else if (roomResults?.status === 'needs_input' && roomResults?.missing) {
    const missingLabels = {
      guest_breakdown: 'broj osoba (odrasli i deca)',
      check_in: 'datum dolaska',
      stay_length_days: 'koliko dana/noći žele da ostanu'
    };
    const missingList = Object.entries(roomResults.missing)
      .filter(([, v]) => v)
      .map(([k]) => missingLabels[k] || k)
      .join(', ');
    if (missingList) {
      parts.push(`NEDOSTAJE za pretragu slobodnih soba: ${missingList}.\nPitaj korisnika prirodno za ono što nedostaje. NE šalji ga na telefon.`);
    }
  }

  if (context && (context.adults || context.check_in || context.stay_length_days)) {
    const known = {};
    if (context.adults) known.odrasli = context.adults;
    if (context.children) known.deca = context.children;
    if (context.check_in) known.dolazak = context.check_in;
    if (context.stay_length_days) known.broj_dana = context.stay_length_days;
    parts.push(`Poznati podaci o gostu: ${JSON.stringify(known)}`);
  }

  if (Array.isArray(history) && history.length > 0) {
    const historyStr = history.slice(-3).map(h => `${h.role}: ${h.text}`).join('\n');
    parts.push(`Prethodne poruke:\n${historyStr}`);
  }

  parts.push(`Korisnikova poruka: ${message}`);

  return parts.join('\n\n');
}

// ─── Local Fallback ───

function getLocalChatFallback(message, facts, roomResults) {
  if (roomResults?.suggestions?.length > 0) {
    const roomNames = roomResults.suggestions.slice(0, 3)
      .map(s => `${s.facility_name} / ${s.room_name}`).join(', ');
    return `Pronašao sam slobodne sobe: ${roomNames}. Kliknite "Rezerviši" na kartici koja vam odgovara.`;
  }

  if (facts.length > 0) {
    const names = facts.slice(0, 5)
      .map(f => f.name || f.ime || f.question || f.type || f.item)
      .filter(Boolean);
    if (names.length > 0) {
      return `Evo šta imam iz naše ponude: ${names.join(', ')}. Pitajte me za detalje.`;
    }
  }

  if (roomResults?.status === 'needs_input' && roomResults?.missing) {
    if (roomResults.missing.guest_breakdown) return 'Koliko vas dolazi? (broj odraslih i dece)';
    if (roomResults.missing.check_in) return 'Koji datum dolaska planirate?';
    if (roomResults.missing.stay_length_days) return 'Koliko dana/noći želite da ostanete?';
  }

  return 'Mogu da pomognem oko smeštaja, aktivnosti, restorana i svega vezanog za Nastavnu bazu Goč. Pitajte slobodno!';
}

// ─── AIService Class ───

class AIService {
  getStatus() {
    const enabledFlag = String(process.env.AI_ENABLED || 'false').toLowerCase() === 'true';
    const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    const apiKey = process.env.AI_API_KEY || '';

    if (!enabledFlag) {
      return { enabled: false, mode: 'disabled', provider: 'none', reason: 'AI feature flag is disabled' };
    }
    if (!getSupportedProvider(provider)) {
      return { enabled: false, mode: 'misconfigured', provider, reason: 'Unsupported AI_PROVIDER' };
    }
    if (provider === 'mock') {
      return { enabled: true, mode: 'demo', provider, reason: 'Demo provider active (no external billing)' };
    }
    if (!apiKey) {
      return { enabled: false, mode: 'misconfigured', provider, reason: 'Missing AI_API_KEY' };
    }
    return { enabled: true, mode: 'live', provider, reason: 'External provider configured' };
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

  isChatEnabled() {
    const flag = String(process.env.AI_CHAT_ASSISTANT_ENABLED || 'true').toLowerCase() === 'true';
    return flag && this.isEnabled();
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
        messages: [{ role: 'user', content: userText }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Anthropic request failed');
    }

    const text = Array.isArray(data?.content)
      ? data.content.filter(item => item?.type === 'text').map(item => item.text).join('\n').trim()
      : '';

    if (!text) {
      throw new Error('Anthropic returned empty text');
    }

    return text;
  }

  // ─── Admin: Proofread ───

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
        suggested_text: truncateToWords(suggested, this.getMaxOutputWords()),
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

  // ─── Admin: Rewrite ───

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
        suggested_text: truncateToWords(rewritten, this.getMaxOutputWords()),
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

  // ─── Chat: AI-first RAG Reply ───

  async composeChatReply({ message, context, roomResults, history, lang = 'sr' } = {}) {
    const allFacts = loadDocsCache();
    const relevantFacts = filterFactsByRelevance(message, allFacts);

    // Check cache
    const cacheKey = getCacheKey(message, context);
    const cached = getCachedReply(cacheKey);
    if (cached) {
      return { ...cached, provider_mode: `${cached.provider_mode || 'unknown'}-cache` };
    }

    // Try live AI
    if (this.isChatEnabled()) {
      const status = this.getStatus();
      if (status.mode === 'live' && status.provider === 'anthropic') {
        try {
          const systemPrompt = buildSystemPrompt(lang);
          const userPrompt = buildUserPrompt(message, relevantFacts, roomResults, context, history);
          const aiText = await this.callAnthropic(systemPrompt, userPrompt, {
            maxTokens: getChatMaxTokens()
          });

          if (aiText) {
            const result = { text: aiText, provider_mode: 'live' };
            cacheReply(cacheKey, result);
            return result;
          }
        } catch (err) {
          console.error('[aiService] Live AI failed, falling back:', err.message);
        }
      }
    }

    // Local fallback
    const fallbackText = getLocalChatFallback(message, relevantFacts, roomResults);
    const result = { text: fallbackText, provider_mode: 'local-fallback' };
    cacheReply(cacheKey, result);
    return result;
  }
}

// ─── Exports ───

const aiServiceInstance = new AIService();

module.exports = aiServiceInstance;
module.exports.getLocalProofread = getLocalProofread;
module.exports.getLocalRewrite = getLocalRewrite;
module.exports.checkMessageSafety = checkMessageSafety;
module.exports.loadDocsCache = loadDocsCache;
