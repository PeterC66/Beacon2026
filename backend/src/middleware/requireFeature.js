// beacon2/backend/src/middleware/requireFeature.js
// Checks that a feature toggle is enabled for the current tenant.
// Must be used AFTER requireAuth middleware.
//
// Usage:
//   router.get('/finance', requireAuth, requireFeature('finance'), handler)

import { tenantQuery } from '../utils/db.js';
import { FEATURE_DEPS, FEATURE_DEFAULTS_OFF, isOn } from '../../../shared/constants.js';

/**
 * Check whether a feature is enabled for a tenant (non-middleware version).
 * Use this in routes that don't go through requireAuth (public, portal).
 * @param {string} tenantSlug
 * @param {string} featureKey
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(tenantSlug, featureKey) {
  const [row] = await tenantQuery(
    tenantSlug,
    `SELECT feature_config FROM tenant_settings WHERE id = 'singleton'`,
  );
  const config = row?.feature_config ?? {};
  const parent = FEATURE_DEPS[featureKey];
  return isOn(config, featureKey) && (!parent || isOn(config, parent));
}

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
      const parent = FEATURE_DEPS[featureKey];
      if (!isOn(config, featureKey) || (parent && !isOn(config, parent))) {
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
