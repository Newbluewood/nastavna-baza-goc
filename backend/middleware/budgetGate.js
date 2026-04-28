const { assertBudget, BudgetExceededError } = require('../services/aiBudgetService');
const { makeFallbackAssistantTurn } = require('../services/assistantTurnSchema');
const FAIL_OPEN_ON_BUDGET_CHECK_ERROR =
  String(process.env.AI_BUDGET_FAIL_OPEN || 'false').toLowerCase() === 'true';

function isTodaysDateQuestion(raw) {
  const c = String(raw || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const m = c.toLowerCase();
  if (/\bwhat\s+('?s\s+)?today'?s?\s+(date|day)\b/i.test(m)) return true;
  if (/\bwhat\s+day\b.*\btoday\b/i.test(m)) return true;
  if (/koji\s+je\s+danas\s+(dan|datum)\b/i.test(m)) return true;
  if (/koja\s+je\s+danas\s+(dan|datum)\b/i.test(m)) return true;
  if (/koji\s+je\s+dan\s+danas\b/i.test(m)) return true;
  if (/koja\s+je\s+dan\s+danas\b/i.test(m)) return true;
  if (/који\s+је\s+данас\s+(дан|датум)\b/i.test(c)) return true;
  if (/која\s+је\s+данас\s+(дан|датум)\b/i.test(c)) return true;
  return false;
}

/**
 * Factory middleware that checks budget before allowing an AI request through.
 * On budget exceeded: responds 200 with a fallback AssistantTurn (graceful degradation).
 * On any other error (DB down etc.): fail-closed — responds 200 with a fallback AssistantTurn
 * tagged reason='budget_check_failed'.
 *
 * On success: attaches `res.locals.aiBudget = { userKey, feature }` so the route handler
 * can call `recordSpend` after the LLM call completes.
 *
 * @param {string} feature e.g. 'site_guide'
 * @returns {Function} Express middleware
 */
function budgetGate(feature) {
  return async (req, res, next) => {
    try {
      const userKey = req.user?.id
        ? `admin:${req.user.id}`
        : (req.guest?.id ? `guest:${req.guest.id}` : `ip:${req.ip || 'unknown'}`);

      await assertBudget({ userKey, feature });
      res.locals.aiBudget = { userKey, feature };
      return next();
    } catch (err) {
      const lang = (req.body && req.body.lang) || 'sr';
      if (err instanceof BudgetExceededError) {
        const fallback = makeFallbackAssistantTurn({ lang, reason: err.code });
        return res.status(200).json(fallback);
      }
      // Keep "today date" question available even when budget DB check is down.
      if (
        feature === 'site_guide' &&
        isTodaysDateQuestion(req.body?.message)
      ) {
        return next();
      }
      if (FAIL_OPEN_ON_BUDGET_CHECK_ERROR) {
        console.error('[budgetGate] non-budget error, fail-open enabled:', err.message);
        return next();
      }
      // Fail-closed on any other error (e.g. DB unreachable).
      console.error('[budgetGate] non-budget error, fail-closed:', err.message);
      const fallback = makeFallbackAssistantTurn({ lang, reason: 'budget_check_failed' });
      return res.status(200).json(fallback);
    }
  };
}

module.exports = budgetGate;
module.exports.budgetGate = budgetGate;
