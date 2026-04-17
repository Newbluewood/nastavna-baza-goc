/**
 * Wraps an async Express route handler so that any thrown error is forwarded
 * to Express's `next(err)` error handler instead of causing an unhandled
 * promise rejection.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 *
 * The central error handler in index.js catches errors passed via next() and
 * responds with { error: 'Server error' } + status 500.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
