'use strict';

// assistantTurnSchema.js
// Versioned response contract for the site-guide AI endpoint.
// Defines the AssistantTurn shape, a runtime validator, and small factory
// helpers (including a static keyword-fallback turn used when the LLM or
// vector DB is unavailable). No external dependencies.

/**
 * @typedef {Object} Suggestion
 * @property {string} label   Human-facing label (1..80 chars).
 * @property {string} route   Target route or URL (1..200 chars).
 * @property {'navigate'|'action'|'external'} type  Interaction kind.
 */

/**
 * @typedef {Object} Source
 * @property {string} id          Source identifier (1..200 chars).
 * @property {string} collection  Qdrant/vector collection name (1..64 chars).
 * @property {number} score       Similarity score in [0, 1].
 */

/**
 * @typedef {Object} AssistantTurn
 * @property {1} schemaVersion                 Literal schema version (currently 1).
 * @property {string} answer                   Assistant answer text (1..4000 chars).
 * @property {'site_guide'|'unknown'} intent   Classified intent for this turn.
 * @property {number} confidence               Confidence in [0, 1].
 * @property {Suggestion[]} suggestions        Up to 6 follow-up suggestions.
 * @property {Source[]} sources                Up to 10 supporting sources.
 * @property {Object} meta                     Free-form metadata bag (never surfaced to UI).
 */

const SCHEMA_VERSION = 1;

const TURN_KEYS = new Set([
  'schemaVersion',
  'answer',
  'intent',
  'confidence',
  'suggestions',
  'sources',
  'meta',
]);
const SUGGESTION_KEYS = new Set(['label', 'route', 'type']);
const SOURCE_KEYS = new Set(['id', 'collection', 'score']);

const INTENT_VALUES = new Set(['site_guide', 'unknown']);
const SUGGESTION_TYPES = new Set(['navigate', 'action', 'external']);

const MAX_ANSWER_LEN = 4000;
const MAX_SUGGESTIONS = 6;
const MAX_SOURCES = 10;
const MAX_LABEL_LEN = 80;
const MAX_ROUTE_LEN = 200;
const MAX_SOURCE_ID_LEN = 200;
const MAX_COLLECTION_LEN = 64;

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) {
    fail(path, `expected object, got ${typeName(value)}`);
  }
}

function assertString(value, path, min, max) {
  if (typeof value !== 'string') {
    fail(path, `expected string, got ${typeName(value)}`);
  }
  if (value.length < min) {
    fail(path, `expected string length >= ${min}, got ${value.length}`);
  }
  if (value.length > max) {
    fail(path, `expected string length <= ${max}, got ${value.length}`);
  }
}

function assertNumberInRange(value, path, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(path, `expected number, got ${typeName(value)}`);
  }
  if (!Number.isFinite(value)) {
    fail(path, 'expected finite number');
  }
  if (value < min || value > max) {
    fail(path, `expected number in [${min}, ${max}], got ${value}`);
  }
}

function assertEnum(value, path, allowedSet, allowedList) {
  if (typeof value !== 'string' || !allowedSet.has(value)) {
    fail(
      path,
      `expected one of ${allowedList.map((v) => `'${v}'`).join('|')}, got ${JSON.stringify(value)}`
    );
  }
}

function assertNoExtraKeys(obj, allowedSet, path) {
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) {
      fail(path, `unknown key "${key}"`);
    }
  }
}

function validateSuggestion(sug, path) {
  assertPlainObject(sug, path);
  if (!('label' in sug)) fail(path, 'missing "label"');
  if (!('route' in sug)) fail(path, 'missing "route"');
  if (!('type' in sug)) fail(path, 'missing "type"');

  assertString(sug.label, `${path}.label`, 1, MAX_LABEL_LEN);
  assertString(sug.route, `${path}.route`, 1, MAX_ROUTE_LEN);
  assertEnum(
    sug.type,
    `${path}.type`,
    SUGGESTION_TYPES,
    ['navigate', 'action', 'external']
  );

  assertNoExtraKeys(sug, SUGGESTION_KEYS, path);
}

function validateSource(src, path) {
  assertPlainObject(src, path);
  if (!('id' in src)) fail(path, 'missing "id"');
  if (!('collection' in src)) fail(path, 'missing "collection"');
  if (!('score' in src)) fail(path, 'missing "score"');

  assertString(src.id, `${path}.id`, 1, MAX_SOURCE_ID_LEN);
  assertString(src.collection, `${path}.collection`, 1, MAX_COLLECTION_LEN);
  assertNumberInRange(src.score, `${path}.score`, 0, 1);

  assertNoExtraKeys(src, SOURCE_KEYS, path);
}

/**
 * Validates a candidate AssistantTurn in place. Iterates keys directly without
 * a JSON round-trip.
 *
 * @param {unknown} obj
 * @returns {AssistantTurn} The same object reference when valid.
 * @throws {TypeError} With a precise, path-based message when invalid.
 */
function validateAssistantTurn(obj) {
  const path = 'AssistantTurn';
  assertPlainObject(obj, path);

  if (!('schemaVersion' in obj)) fail(path, 'missing "schemaVersion"');
  if (!('answer' in obj)) fail(path, 'missing "answer"');
  if (!('intent' in obj)) fail(path, 'missing "intent"');
  if (!('confidence' in obj)) fail(path, 'missing "confidence"');
  if (!('suggestions' in obj)) fail(path, 'missing "suggestions"');
  if (!('sources' in obj)) fail(path, 'missing "sources"');
  if (!('meta' in obj)) fail(path, 'missing "meta"');

  if (obj.schemaVersion !== SCHEMA_VERSION) {
    fail(
      `${path}.schemaVersion`,
      `expected literal ${SCHEMA_VERSION}, got ${JSON.stringify(obj.schemaVersion)}`
    );
  }

  assertString(obj.answer, `${path}.answer`, 1, MAX_ANSWER_LEN);
  assertEnum(
    obj.intent,
    `${path}.intent`,
    INTENT_VALUES,
    ['site_guide', 'unknown']
  );
  assertNumberInRange(obj.confidence, `${path}.confidence`, 0, 1);

  if (!Array.isArray(obj.suggestions)) {
    fail(`${path}.suggestions`, `expected array, got ${typeName(obj.suggestions)}`);
  }
  if (obj.suggestions.length > MAX_SUGGESTIONS) {
    fail(
      `${path}.suggestions`,
      `expected array length <= ${MAX_SUGGESTIONS}, got ${obj.suggestions.length}`
    );
  }
  for (let i = 0; i < obj.suggestions.length; i++) {
    validateSuggestion(obj.suggestions[i], `${path}.suggestions[${i}]`);
  }

  if (!Array.isArray(obj.sources)) {
    fail(`${path}.sources`, `expected array, got ${typeName(obj.sources)}`);
  }
  if (obj.sources.length > MAX_SOURCES) {
    fail(
      `${path}.sources`,
      `expected array length <= ${MAX_SOURCES}, got ${obj.sources.length}`
    );
  }
  for (let i = 0; i < obj.sources.length; i++) {
    validateSource(obj.sources[i], `${path}.sources[${i}]`);
  }

  // meta is an open bag; only enforce shape, not inner keys.
  assertPlainObject(obj.meta, `${path}.meta`);

  assertNoExtraKeys(obj, TURN_KEYS, path);

  return /** @type {AssistantTurn} */ (obj);
}

/**
 * Builds an AssistantTurn from a partial input, filling defaults for
 * `schemaVersion`, `suggestions`, `sources`, and `meta`. The resulting object
 * is validated before being returned (so unknown keys on the partial surface
 * as TypeErrors).
 *
 * @param {Partial<AssistantTurn>} [partial]
 * @returns {AssistantTurn}
 * @throws {TypeError} When validation fails.
 */
function makeAssistantTurn(partial) {
  const input = partial == null ? {} : partial;
  if (!isPlainObject(input)) {
    throw new TypeError(
      `AssistantTurn: expected object, got ${typeName(input)}`
    );
  }

  const turn = {
    schemaVersion: SCHEMA_VERSION,
    ...input,
  };

  if (turn.suggestions === undefined) turn.suggestions = [];
  if (turn.sources === undefined) turn.sources = [];
  if (turn.meta === undefined) turn.meta = {};

  return validateAssistantTurn(turn);
}

/**
 * Produces a valid AssistantTurn with no LLM/vector-DB call, used as a safe
 * fallback when the upstream services are unavailable. Localized for Serbian
 * (`sr`, default) and English (`en`).
 *
 * @param {{ lang?: 'sr'|'en', reason?: string }} [opts]
 * @returns {AssistantTurn}
 */
function makeFallbackAssistantTurn(opts) {
  const safe = opts == null ? {} : opts;
  const lang = safe.lang === 'en' ? 'en' : 'sr';
  const reason =
    typeof safe.reason === 'string' && safe.reason.length > 0
      ? safe.reason
      : 'service_unavailable';

  let answer;
  let suggestions;
  if (lang === 'en') {
    answer = 'I cannot search right now. You can browse manually:';
    suggestions = [
      { label: 'Accommodation', route: '/smestaj', type: 'navigate' },
      { label: 'News', route: '/vesti', type: 'navigate' },
      { label: 'Contact', route: '/kontakt', type: 'navigate' },
    ];
  } else {
    answer =
      'Trenutno ne mogu da pretražim bazu. Možete ručno pregledati stranice:';
    suggestions = [
      { label: 'Smeštaj', route: '/smestaj', type: 'navigate' },
      { label: 'Vesti', route: '/vesti', type: 'navigate' },
      { label: 'Kontakt', route: '/kontakt', type: 'navigate' },
    ];
  }

  return makeAssistantTurn({
    answer,
    intent: 'unknown',
    confidence: 0,
    suggestions,
    sources: [],
    meta: { reason },
  });
}

module.exports = {
  SCHEMA_VERSION,
  validateAssistantTurn,
  makeAssistantTurn,
  makeFallbackAssistantTurn,
};
