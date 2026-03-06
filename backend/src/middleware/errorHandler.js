// beacon2/backend/src/middleware/errorHandler.js
// Central error handler. Always returns JSON. Never exposes stack traces in production.

export function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV === 'development';

  // Log all errors server-side
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err);

  // Known application errors (thrown with a status property)
  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      ...(isDev && { stack: err.stack }),
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: 'Validation error',
      issues: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // Unknown errors — don't expose details in production
  res.status(500).json({
    error: 'An unexpected error occurred.',
    ...(isDev && { detail: err.message, stack: err.stack }),
  });
}

/**
 * Create a structured application error.
 * @param {string} message
 * @param {number} status - HTTP status code
 */
export function AppError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}
