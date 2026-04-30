const chatMetricsService = require('../../services/chatMetricsService');

async function getChatMetrics(req, res) {
  const snapshot = chatMetricsService.getSnapshot();
  return res.json(snapshot);
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
  const metrics = chatMetricsService.getSnapshot();
  return res.status(200).json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    budget,
    budgetError,
    metrics: {
      startedAt: metrics.startedAt,
      totals: metrics.totals,
      tokenEstimates: metrics.token_estimates,
      recent: metrics.recent
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
