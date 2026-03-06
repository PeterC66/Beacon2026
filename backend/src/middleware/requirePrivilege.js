// beacon2/backend/src/middleware/requirePrivilege.js
// Checks that the authenticated user holds a specific privilege.
// Must be used AFTER requireAuth middleware.
//
// Usage:
//   router.get('/roles', requireAuth, requirePrivilege('roles_list', 'view'), handler)
//   router.post('/roles', requireAuth, requirePrivilege('role_record', 'create'), handler)

/**
 * Middleware factory.
 * @param {string} resource - privilege resource code, e.g. 'role_record'
 * @param {string} action   - e.g. 'view' | 'create' | 'change' | 'delete' | 'download'
 */
export function requirePrivilege(resource, action) {
  return (req, res, next) => {
    const { privileges = [] } = req.user ?? {};

    // Privileges in the JWT are stored as "resource:action" strings
    const required = `${resource}:${action}`;

    if (privileges.includes(required)) {
      return next();
    }

    return res.status(403).json({
      error: `You do not have permission to perform this action.`,
      required: required,
    });
  };
}

/**
 * Check (without responding) whether the current user has a privilege.
 * Useful in controllers when branching logic depends on access level.
 *
 * @param {string[]} privileges - from req.user.privileges
 * @param {string} resource
 * @param {string} action
 * @returns {boolean}
 */
export function hasPrivilege(privileges, resource, action) {
  return privileges.includes(`${resource}:${action}`);
}
