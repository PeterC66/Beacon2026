// beacon2/backend/src/utils/logger.js
//
// Minimal, dependency-free structured logger.
//
// Goals:
//   - Levels (error > warn > info > debug) gated by LOG_LEVEL, so noisy
//     diagnostics can be turned down in production without code changes.
//   - One readable line per call: timestamp, level, message, and an optional
//     context object serialised as JSON.
//   - Backed by the matching console method (error→console.error,
//     warn→console.warn, info/debug→console.log) so existing test spies and
//     platform log capture keep working unchanged.
//
// NOT a redaction layer: it does not scrub values for you. Never pass tokens,
// passwords, reset/verification links, or member PII (e.g. raw email
// addresses) into a log call. Put only non-identifying diagnostics in the
// message and context (error messages, ids, counts, booleans).

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function resolveThreshold() {
  const fromEnv = (process.env.LOG_LEVEL || '').toLowerCase();
  if (fromEnv in LEVELS) return LEVELS[fromEnv];
  // Default: quieter in production, chattier elsewhere — but never below info,
  // so warnings and errors always surface.
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

const CONSOLE_FOR = {
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: 'log',
};

function emit(level, message, context) {
  if (LEVELS[level] > resolveThreshold()) return;
  const ts = new Date().toISOString();
  let line = `${ts} [${level}] ${message}`;
  if (context !== undefined && context !== null) {
    try {
      line += ` ${JSON.stringify(context)}`;
    } catch {
      // Circular or non-serialisable context — fall back to a marker rather
      // than throwing inside a log call.
      line += ' [unserialisable context]';
    }
  }
  console[CONSOLE_FOR[level]](line);
}

export const logger = {
  error: (message, context) => emit('error', message, context),
  warn: (message, context) => emit('warn', message, context),
  info: (message, context) => emit('info', message, context),
  debug: (message, context) => emit('debug', message, context),
};

export default logger;
