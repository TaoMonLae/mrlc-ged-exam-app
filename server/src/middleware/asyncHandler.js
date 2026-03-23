/**
 * Wraps an async Express route handler so unhandled promise rejections
 * are forwarded to Express's error middleware instead of crashing the process.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

module.exports = { asyncHandler }
