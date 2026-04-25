/**
 * Token-to-EUR pricing table. Used by aiBudgetService to compute spend.
 * All prices are per 1,000,000 tokens (per-1M), in EUR.
 * Update when model or pricing changes. Keep fields stable for backward compat.
 */
module.exports = {
  'claude-sonnet-4-6': {
    inputPerMTokensEur: 2.8,
    outputPerMTokensEur: 14.0
  },
  'claude-3-5-sonnet': {
    inputPerMTokensEur: 2.8,
    outputPerMTokensEur: 14.0
  },
  // Default when model not recognized
  _default: {
    inputPerMTokensEur: 3.0,
    outputPerMTokensEur: 15.0
  }
};

function tokensToEur({ model, tokensIn = 0, tokensOut = 0 }) {
  const entry = module.exports[model] || module.exports._default;
  const eur =
    (Number(tokensIn) / 1_000_000) * entry.inputPerMTokensEur +
    (Number(tokensOut) / 1_000_000) * entry.outputPerMTokensEur;
  return Number(eur.toFixed(6));
}

module.exports.tokensToEur = tokensToEur;
