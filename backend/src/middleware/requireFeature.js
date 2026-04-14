// beacon2/backend/src/middleware/requireFeature.js
// Checks that a feature toggle is enabled for the current tenant.
// Must be used AFTER requireAuth middleware.
//
// Usage:
//   router.get('/finance', requireAuth, requireFeature('finance'), handler)

import { tenantQuery } from '../utils/db.js';

/**
 * Middleware factory.
 * @param {string} featureKey - feature toggle key, e.g. 'finance', 'giftAid'
 */
export function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const [row] = await tenantQuery(
        req.user.tenantSlug,
        `SELECT feature_config FROM tenant_settings WHERE id = 'singleton'`,
      );
      const config = row?.feature_config ?? {};
      // Missing key = enabled (opt-out model)
      if (config[featureKey] === false) {
        return res.status(403).json({
          error: 'This feature is not enabled for your u3a.',
          feature: featureKey,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
