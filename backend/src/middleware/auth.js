// beacon2/backend/src/middleware/auth.js
// Validates the Bearer access token on every protected request.
// Attaches req.user = { userId, tenantSlug, privileges, iat } on success.

import { verifyAccessToken } from '../utils/jwt.js';
import { isSessionInvalidated } from '../utils/redis.js';

/**
 * Standard user auth middleware.
 * Attach to any route that requires a logged-in u3a user.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Check if this user's sessions were invalidated (e.g. role change)
    const invalidated = await isSessionInvalidated(
      payload.tenantSlug,
      payload.userId,
      payload.iat,
    );
    if (invalidated) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * System admin auth middleware.
 * Attach to /system routes. Validates the token and checks the isSysAdmin flag.
 */
export async function requireSysAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    if (!payload.isSysAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    req.sysAdmin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}
