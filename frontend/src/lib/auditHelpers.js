// beacon2/frontend/src/lib/auditHelpers.js
// Shared helpers for audit log pages

// Maps entity_type values to their frontend route prefix.
// Only entity types that have an individual view page are listed.
export const ENTITY_ROUTES = {
  member:       '/members',
  user:         '/users',
  role:         '/roles',
  transactions: '/finance/transactions',
};
