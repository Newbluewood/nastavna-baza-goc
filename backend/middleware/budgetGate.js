const { assertBudget, BudgetExceededError } = require('../services/aiBudgetService');
const { makeFallbackAssistantTurn } = require('../services/assistantTurnSchema');

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
      // Fail-closed on any other error (e.g. DB unreachable).
      console.error('[budgetGate] non-budget error, fail-closed:', err.message);
      const fallback = makeFallbackAssistantTurn({ lang, reason: 'budget_check_failed' });
      return res.status(200).json(fallback);
    }
  };
}

module.exports = budgetGate;
module.exports.budgetGate = budgetGate;
