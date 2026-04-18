const state = {
  startedAt: new Date().toISOString(),
  totals: {
    plan_stay_requests: 0,
    blocked_requests: 0,
    in_domain_requests: 0,
    out_of_domain_requests: 0,
    unsafe_requests: 0
  },
  breakdown: {
    guard_class: {},
    intent_name: {},
    action_name: {},
    decision_source: {},
    assistant_provider_mode: {}
  },
  token_estimates: {
    hypothetical_live_tokens: 0,
    actual_live_tokens: 0,
    saved_tokens: 0
  },
  recent: []
};

function bump(bucket, key) {
  const normalizedKey = key || 'unknown';
  bucket[normalizedKey] = Number(bucket[normalizedKey] || 0) + 1;
}

function estimateWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function estimateReplyTokensFromText(text) {
  const words = estimateWords(text);
  return Math.max(18, Math.ceil(words * 1.35));
}

function estimateActualLiveTokens(decisionSource, assistantProviderMode, assistantText) {
  let total = 0;

  const src = String(decisionSource || '').toLowerCase();
  if (src.includes('live')) {
    total += 220;
  }

  const mode = String(assistantProviderMode || '').toLowerCase();
  if (mode.includes('live')) {
    total += estimateReplyTokensFromText(assistantText);
  }

  return total;
}

function estimateHypotheticalLiveTokens() {
  // Approximation: live intent classification + live response generation.
  return 220 + 120;
}

function pushRecent(entry) {
  state.recent.unshift(entry);
  if (state.recent.length > 40) {
    state.recent.length = 40;
  }
}

function recordPlanStayTurn(payload = {}) {
  const guardClass = payload.guardClass || 'unknown';
  const intentName = payload.intentName || 'unknown';
  const actionName = payload.actionName || 'none';
  const decisionSource = payload.decisionSource || 'unknown';
  const assistantProviderMode = payload.assistantProviderMode || 'unknown';
  const assistantText = payload.assistantText || '';

  state.totals.plan_stay_requests += 1;

  if (guardClass === 'in_domain') state.totals.in_domain_requests += 1;
  if (guardClass === 'out_of_domain') state.totals.out_of_domain_requests += 1;
  if (guardClass === 'unsafe') state.totals.unsafe_requests += 1;
  if (guardClass !== 'in_domain') state.totals.blocked_requests += 1;

  bump(state.breakdown.guard_class, guardClass);
  bump(state.breakdown.intent_name, intentName);
  bump(state.breakdown.action_name, actionName);
  bump(state.breakdown.decision_source, decisionSource);
  bump(state.breakdown.assistant_provider_mode, assistantProviderMode);

  const hypothetical = estimateHypotheticalLiveTokens();
  const actual = estimateActualLiveTokens(decisionSource, assistantProviderMode, assistantText);
  const saved = Math.max(0, hypothetical - actual);

  state.token_estimates.hypothetical_live_tokens += hypothetical;
  state.token_estimates.actual_live_tokens += actual;
  state.token_estimates.saved_tokens += saved;

  pushRecent({
    at: new Date().toISOString(),
    guardClass,
    intentName,
    actionName,
    decisionSource,
    assistantProviderMode,
    estimated: {
      hypothetical,
      actual,
      saved
    }
  });
}

function getSnapshot() {
  const req = Number(state.totals.plan_stay_requests || 0);
  const saved = Number(state.token_estimates.saved_tokens || 0);
  const hypothetical = Number(state.token_estimates.hypothetical_live_tokens || 0);
  const actual = Number(state.token_estimates.actual_live_tokens || 0);

  return {
    startedAt: state.startedAt,
    totals: { ...state.totals },
    breakdown: {
      guard_class: { ...state.breakdown.guard_class },
      intent_name: { ...state.breakdown.intent_name },
      action_name: { ...state.breakdown.action_name },
      decision_source: { ...state.breakdown.decision_source },
      assistant_provider_mode: { ...state.breakdown.assistant_provider_mode }
    },
    token_estimates: {
      hypothetical_live_tokens: hypothetical,
      actual_live_tokens: actual,
      saved_tokens: saved,
      saved_percent: hypothetical > 0 ? Number(((saved / hypothetical) * 100).toFixed(2)) : 0,
      avg_saved_tokens_per_turn: req > 0 ? Number((saved / req).toFixed(2)) : 0
    },
    recent: [...state.recent]
  };
}

module.exports = {
  recordPlanStayTurn,
  getSnapshot
};
