const chatMetricsService = require('../../services/chatMetricsService');
const chatAnalyticsService = require('../../services/chatAnalyticsService');
const posthogStatsService = require('../../services/posthogStatsService');

async function getChatMetrics(req, res) {
  const snapshot = chatMetricsService.getSnapshot();
  return res.json(snapshot);
}

async function getChatAnalyticsTop(req, res) {
  const days = req.query.days;
  const limit = req.query.limit;
  const [items, summary] = await Promise.all([
    chatAnalyticsService.getTopQueries({ days, limit }),
    chatAnalyticsService.getAnalyticsSummary({ days })
  ]);
  return res.json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    days: chatAnalyticsService.parseDays(days),
    limit: chatAnalyticsService.parseLimit(limit),
    summary,
    items
  });
}

async function getChatAnalyticsMiss(req, res) {
  const days = req.query.days;
  const limit = req.query.limit;
  const [items, summary] = await Promise.all([
    chatAnalyticsService.getMissQueries({ days, limit }),
    chatAnalyticsService.getAnalyticsSummary({ days })
  ]);
  return res.json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    days: chatAnalyticsService.parseDays(days),
    limit: chatAnalyticsService.parseLimit(limit),
    missConfidenceMax: chatAnalyticsService.missConfidenceMax(),
    summary,
    items
  });
}

async function getSiteStats(req, res) {
  const days = req.query.days;
  const [posthog, ragTop, ragMiss, ragSummary] = await Promise.all([
    posthogStatsService.getSiteStats({ days }),
    chatAnalyticsService.getTopQueries({ days, limit: 8 }).catch(() => []),
    chatAnalyticsService.getMissQueries({ days, limit: 8 }).catch(() => []),
    chatAnalyticsService.getAnalyticsSummary({ days }).catch(() => null)
  ]);

  return res.json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    days: posthogStatsService.parseDays(days),
    posthog,
    rag: {
      summary: ragSummary,
      top: ragTop,
      miss: ragMiss
    }
  });
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

async function refreshAgentKnowledge(req, res) {
  const { notifyKnowledgeIngest } = require('../../services/knowledgeIngestNotify');
  const result = await notifyKnowledgeIngest('cms-button');
  if (result.skipped) {
    return res.status(503).json({
      error: 'Освежавање знања није подешено на серверу. Поставите INGEST_WEBHOOK_URL и INGEST_WEBHOOK_SECRET на site API (Render).'
    });
  }
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      return res.status(502).json({
        error: 'Чет агент је одбио освежавање (неисправан INGEST_WEBHOOK_SECRET). Исти secret мора бити на baza-goc-api и chat-agent.'
      });
    }
    if (result.status === 404) {
      return res.status(502).json({
        error: 'INGEST_WEBHOOK_URL не показује на /api/ingest чет агента. Очекивано: https://chat-agent-psjk.onrender.com/api/ingest'
      });
    }
    if (result.status === 503) {
      return res.status(502).json({
        error: 'Чет агент нема подешен INGEST_WEBHOOK_SECRET (503). Додајте га на Render → chat-agent → Environment.'
      });
    }
    const detail = result.status
      ? `HTTP ${result.status}`
      : (result.error || 'мрежа/timeout');
    return res.status(502).json({
      error: `Чет агент није прихватио освежавање (${detail}). Проверите да ли је агент подигнут и да ли webhook env одговара.`
    });
  }
  return res.status(202).json({
    ok: true,
    message: 'Освежавање знања је покренуто. Чет агент преузима садржај сајта за који минут.'
  });
}

module.exports = {
  getChatMetrics,
  getChatAnalyticsTop,
  getChatAnalyticsMiss,
  getSiteStats,
  getAiUsage,
  seedSiteKbNow,
  purgeCache,
  refreshAgentKnowledge
};
