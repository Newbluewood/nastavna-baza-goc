'use strict';

// assistantTurnSchema.test.js
// Pure unit tests for the versioned AssistantTurn schema. No mocks needed.

const {
  SCHEMA_VERSION,
  validateAssistantTurn,
  makeAssistantTurn,
  makeFallbackAssistantTurn,
} = require('../../services/assistantTurnSchema');

function validTurn(overrides) {
  return Object.assign(
    {
      schemaVersion: 1,
      answer: 'Hello.',
      intent: 'site_guide',
      confidence: 0.42,
      suggestions: [
        { label: 'Smeštaj', route: '/smestaj', type: 'navigate' },
      ],
      sources: [
        { id: 'r1', collection: 'site_kb', score: 0.8 },
      ],
      meta: { reason: 'ok' },
    },
    overrides || {}
  );
}

describe('assistantTurnSchema - SCHEMA_VERSION', () => {
  it('exports the literal schema version 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe('makeAssistantTurn', () => {
  it('fills defaults for a valid minimal partial', () => {
    const turn = makeAssistantTurn({
      answer: 'Kratak odgovor.',
      intent: 'site_guide',
      confidence: 0.5,
    });

    expect(turn.schemaVersion).toBe(1);
    expect(turn.answer).toBe('Kratak odgovor.');
    expect(turn.intent).toBe('site_guide');
    expect(turn.confidence).toBe(0.5);
    expect(turn.suggestions).toEqual([]);
    expect(turn.sources).toEqual([]);
    expect(turn.meta).toEqual({});
  });
});

describe('validateAssistantTurn - positive case', () => {
  it('accepts a fully-populated well-formed turn', () => {
    const turn = validTurn();
    expect(validateAssistantTurn(turn)).toBe(turn);
  });
});

describe('validateAssistantTurn - structural rejections', () => {
  it('rejects unknown top-level keys', () => {
    const bad = validTurn();
    bad.extraKey = 'x';
    expect(() => validateAssistantTurn(bad)).toThrow(TypeError);
    expect(() => validateAssistantTurn(bad)).toThrow(/unknown key "extraKey"/);
  });

  it('rejects unknown keys inside a suggestion', () => {
    const bad = validTurn({
      suggestions: [
        { label: 'X', route: '/x', type: 'navigate', foo: 'bar' },
      ],
    });
    expect(() => validateAssistantTurn(bad)).toThrow(TypeError);
    expect(() => validateAssistantTurn(bad)).toThrow(/unknown key "foo"/);
  });

  it('rejects missing schemaVersion', () => {
    const bad = validTurn();
    delete bad.schemaVersion;
    expect(() => validateAssistantTurn(bad)).toThrow(/missing "schemaVersion"/);
  });

  it('rejects missing answer', () => {
    const bad = validTurn();
    delete bad.answer;
    expect(() => validateAssistantTurn(bad)).toThrow(/missing "answer"/);
  });

  it('rejects missing intent', () => {
    const bad = validTurn();
    delete bad.intent;
    expect(() => validateAssistantTurn(bad)).toThrow(/missing "intent"/);
  });

  it('rejects wrong schemaVersion literal (e.g. 2)', () => {
    const bad = validTurn({ schemaVersion: 2 });
    expect(() => validateAssistantTurn(bad)).toThrow(/expected literal 1/);
  });

  it('rejects intent not in ["site_guide","unknown"]', () => {
    const bad = validTurn({ intent: 'weather' });
    expect(() => validateAssistantTurn(bad)).toThrow(TypeError);
  });

  it('rejects confidence below 0', () => {
    const bad = validTurn({ confidence: -0.1 });
    expect(() => validateAssistantTurn(bad)).toThrow(/confidence/);
  });

  it('rejects confidence above 1', () => {
    const bad = validTurn({ confidence: 1.1 });
    expect(() => validateAssistantTurn(bad)).toThrow(/confidence/);
  });

  it('rejects suggestions array longer than 6', () => {
    const tooMany = Array.from({ length: 7 }, (_v, i) => ({
      label: `L${i}`,
      route: `/r${i}`,
      type: 'navigate',
    }));
    const bad = validTurn({ suggestions: tooMany });
    expect(() => validateAssistantTurn(bad)).toThrow(/suggestions/);
  });

  it('rejects sources array longer than 10', () => {
    const tooMany = Array.from({ length: 11 }, (_v, i) => ({
      id: `id${i}`,
      collection: 'site_kb',
      score: 0.5,
    }));
    const bad = validTurn({ sources: tooMany });
    expect(() => validateAssistantTurn(bad)).toThrow(/sources/);
  });

  it('rejects oversized answer (length 4001)', () => {
    const bad = validTurn({ answer: 'a'.repeat(4001) });
    expect(() => validateAssistantTurn(bad)).toThrow(/answer/);
  });
});

describe('makeFallbackAssistantTurn', () => {
  it('returns a valid turn with intent="unknown", confidence=0, 3 suggestions, meta.reason="service_unavailable"', () => {
    const turn = makeFallbackAssistantTurn();
    expect(() => validateAssistantTurn(turn)).not.toThrow();
    expect(turn.intent).toBe('unknown');
    expect(turn.confidence).toBe(0);
    expect(turn.suggestions.length).toBe(3);
    expect(turn.meta.reason).toBe('service_unavailable');
  });

  it('English suggestions include label "Accommodation" when lang="en"', () => {
    const turn = makeFallbackAssistantTurn({ lang: 'en' });
    expect(() => validateAssistantTurn(turn)).not.toThrow();
    const labels = turn.suggestions.map((s) => s.label);
    expect(labels).toContain('Accommodation');
  });

  it('honors reason override for sr lang', () => {
    const turn = makeFallbackAssistantTurn({ lang: 'sr', reason: 'llm_down' });
    expect(() => validateAssistantTurn(turn)).not.toThrow();
    expect(turn.meta.reason).toBe('llm_down');
  });
});
