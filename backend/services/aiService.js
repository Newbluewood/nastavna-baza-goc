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

  async callAnthropic(systemPrompt, userText) {
    const apiKey = process.env.AI_API_KEY;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.getModel(),
        max_tokens: this.getMaxOutputTokens(),
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
}

module.exports = new AIService();
