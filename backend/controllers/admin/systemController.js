'use strict';

/**
 * systemController.js
 * 
 * Handles administrative system tasks and metrics.
 * Updated to handle removal of internal AI chat services.
 */

// Placeholder for removed chat metrics
const emptyMetrics = {
  startedAt: new Date().toISOString(),
  totals: {
    plan_stay_requests: 0,
    blocked_requests: 0,
    in_domain_requests: 0,
    out_of_domain_requests: 0,
    unsafe_requests: 0
  },
  token_estimates: {
    hypothetical_live_tokens: 0,
    actual_live_tokens: 0,
    saved_tokens: 0,
    saved_percent: 0,
    avg_saved_tokens_per_turn: 0
  },
  recent: []
};

async function getChatMetrics(req, res) {
  return res.json(emptyMetrics);
}

async function getAiUsage(req, res) {
  const { getUsageSnapshot } = require('../../services/aiBudgetService');
  let budget = null;
  let budgetError = null;

  try {
    budget = await getUsageSnapshot();
  } catch (err) {
    budgetError = { message: err.message };
  }

  return res.status(200).json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    budget,
    budgetError,
    metrics: {
      startedAt: emptyMetrics.startedAt,
      totals: emptyMetrics.totals,
      tokenEstimates: emptyMetrics.token_estimates,
      recent: emptyMetrics.recent
    }
  });
}

async function seedSiteKbNow(req, res) {
  const { seedSiteKb } = require('../../scripts/seed-site-kb');
  const result = await seedSiteKb();
  return res.status(200).json({
    ok: true,
    message: 'site_kb seed completed',
    result
  });
}

async function purgeCache(req, res) {
  const cacheService = require('../../services/cacheService');
  cacheService.clear();
  res.json({ message: 'Cache successfully purged' });
}

module.exports = { getChatMetrics, getAiUsage, seedSiteKbNow, purgeCache };
