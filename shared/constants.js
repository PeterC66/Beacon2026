// shared/constants.js
// Canonical definitions shared between backend and frontend.
// Both sides import from here to guarantee they stay in sync.

// ── Feature toggle configuration ────────────────────────────────────────

// Sub-feature → master-toggle dependency map.
// When a master toggle is off, all its dependents are treated as off too.
export const FEATURE_DEPS = {
  teams: 'groups', venues: 'groups', faculties: 'groups',
  groupLedger: 'groups', siteworks: 'groups',
  calendar: 'events', eventTypes: 'events',
  creditBatches: 'finance', reconciliation: 'finance',
  financialStatement: 'finance', groupsStatement: 'finance',
  transferMoney: 'finance',
};

// Features that default to OFF when the key is missing from feature_config.
// All other features default to ON (opt-out model).
export const FEATURE_DEFAULTS_OFF = new Set(['giftAid', 'groupLedger', 'siteworks']);

/** Is a single feature key on, considering its default? */
export function isOn(config, key) {
  if (key in config) return config[key] !== false;
  return !FEATURE_DEFAULTS_OFF.has(key);
}

// ── Payment methods ─────────────────────────────────────────────────────
// Canonical lists by context.  Each consumer imports the list it needs
// rather than defining its own, so additions stay consistent.

/** Finance transactions (accounts, ledger, payment-method defaults). */
export const FINANCE_PAYMENT_METHODS = [
  'Cheque', 'Cash', 'PayPal', 'Standing Order', 'Direct Debit',
  'BACS', 'Debit card', 'Account transfer', 'Credit card',
];

/** Member records (member editor — includes BACS). */
export const MEMBER_PAYMENT_METHODS = [
  'Cash', 'Cheque', 'Standing Order', 'Direct Debit', 'BACS', 'Online', 'Other',
];

/** System settings and membership renewals. */
export const SETTINGS_PAYMENT_METHODS = [
  'Cash', 'Cheque', 'Standing Order', 'Direct Debit', 'Online', 'Other',
];

/** All known payment methods (used in member-list filter). */
export const ALL_PAYMENT_METHODS = [
  'Cash', 'Cheque', 'PayPal', 'Standing Order', 'Direct Debit',
  'BACS', 'Debit card', 'Account transfer', 'Credit card', 'Online', 'Other',
];

// ── Validation patterns ─────────────────────────────────────────────────

/** Standard UK postcode pattern (outward + optional space + inward). */
export const UK_POSTCODE_RE = /^(GIR\s?0AA|[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2})$/i;
