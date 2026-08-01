// shared/constants.js
// Canonical definitions shared between backend and frontend.
// Both sides import from here to guarantee they stay in sync.

// ── Feature toggle configuration ────────────────────────────────────────

// Sub-feature → master-toggle dependency map.
// When a master toggle is off, all its dependents are treated as off too.
export const FEATURE_DEPS = {
  teams: 'groups',
  venues: 'groups',
  faculties: 'groups',
  groupLedger: 'groups',
  siteworks: 'groups',
  eventTypes: 'events',
  eventAttendance: 'events',
  creditBatches: 'finance',
  reconciliation: 'finance',
  financialStatement: 'finance',
  groupsStatement: 'finance',
  transferMoney: 'finance',
};

// Features that default to OFF when the key is missing from feature_config.
// All other features default to ON (opt-out model).
export const FEATURE_DEFAULTS_OFF = new Set([
  'giftAid',
  'groupLedger',
  'siteworks',
  // The public read API is a published external interface. A u3a that has
  // never heard of it must be unaffected by it, so it defaults off and is
  // opted into deliberately — see docs/API-design.md.
  'publicApi',
]);

/** Is a single feature key on, considering its default? */
export function isOn(config, key) {
  if (key in config) return config[key] !== false;
  return !FEATURE_DEFAULTS_OFF.has(key);
}

// Canonical ordered inventory of every feature toggle key.  Matches the SECTIONS
// definition in frontend/src/pages/settings/FeatureConfig.jsx.  Route allowlists
// (sys-admin and per-user PATCH endpoints) import this constant so they cannot
// drift from the UI definition.
export const ALL_FEATURE_KEYS = Object.freeze([
  // Masters
  'groups',
  'finance',
  'email',
  'portal',
  'onlineJoining',
  'events',
  // Membership sub-features
  'membershipCards',
  'membershipRenewals',
  'giftAid',
  'customFields',
  'polls',
  'memberPhotos',
  // Groups sub-features
  'teams',
  'venues',
  'faculties',
  'groupLedger',
  'siteworks',
  // Events sub-features
  'eventTypes',
  'eventAttendance',
  // Finance sub-features
  'creditBatches',
  'reconciliation',
  'financialStatement',
  'groupsStatement',
  'transferMoney',
  // Communications
  'letters',
  // Other
  'reports',
  'publicPages',
  'publicApi',
]);

// ── Public read API ─────────────────────────────────────────────────────
// The version served at /api/v1. Bumping this is a deliberate act with a
// six-month notice period attached — see docs/API-design.md.
export const API_VERSION = 'v1';

// ── Standard Beacon Implementations ─────────────────────────────────────
// Named presets for the full feature_config JSON.  An entry is applied to a
// tenant's feature_config at a specific moment (currently: after restoring a
// legacy Beacon backup, we apply STANDARD_IMPLEMENTATIONS[0]).  The `features`
// object always contains every key in ALL_FEATURE_KEYS so a preset can never
// silently omit a toggle when new features are added.

function buildStandardFeatures(overrides) {
  const out = {};
  for (const key of ALL_FEATURE_KEYS) out[key] = true;
  return { ...out, ...overrides };
}

export const STANDARD_IMPLEMENTATIONS = Object.freeze([
  Object.freeze({
    name: 'Beacon Migration Default',
    description:
      'All features enabled except SiteWorks Integration and Custom Fields — the recommended starting point for a u3a migrating from Beacon.',
    features: Object.freeze(
      buildStandardFeatures({
        siteworks: false,
        customFields: false,
      }),
    ),
  }),
]);

// ── Payment methods ─────────────────────────────────────────────────────
// Canonical lists by context.  Each consumer imports the list it needs
// rather than defining its own, so additions stay consistent.

/** Finance transactions (accounts, ledger, payment-method defaults). */
export const FINANCE_PAYMENT_METHODS = [
  'Cheque',
  'Cash',
  'PayPal',
  'Standing Order',
  'Direct Debit',
  'BACS',
  'Debit card',
  'Account transfer',
  'Credit card',
];

/** Member records (member editor — includes BACS). */
export const MEMBER_PAYMENT_METHODS = [
  'Cash',
  'Cheque',
  'Standing Order',
  'Direct Debit',
  'BACS',
  'Online',
  'Other',
];

/** System settings and membership renewals. */
export const SETTINGS_PAYMENT_METHODS = [
  'Cash',
  'Cheque',
  'Standing Order',
  'Direct Debit',
  'Online',
  'Other',
];

/** All known payment methods (used in member-list filter). */
export const ALL_PAYMENT_METHODS = [
  'Cash',
  'Cheque',
  'PayPal',
  'Standing Order',
  'Direct Debit',
  'BACS',
  'Debit card',
  'Account transfer',
  'Credit card',
  'Online',
  'Other',
];

// ── Validation patterns ─────────────────────────────────────────────────

/** Standard UK postcode pattern (outward + optional space + inward). */
export const UK_POSTCODE_RE = /^(GIR\s?0AA|[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

// ── Privileges ──────────────────────────────────────────────────────────

/**
 * Encode a privilege as the canonical `resource:action` string stored in the
 * JWT and matched by the backend (`requirePrivilege`) and frontend (`can`).
 *
 * Single source of truth so both ends always build the string identically.
 * Resource codes MAY contain `:` (e.g. `finance:transactions`); actions must
 * not — that invariant keeps the action as the unambiguous final segment and
 * removes any risk of two distinct (resource, action) pairs colliding to the
 * same string. The guard below enforces it.
 *
 * @param {string} resource - privilege resource code
 * @param {string} action   - e.g. 'view' | 'create' | 'change' | 'delete' | 'download'
 * @returns {string}
 */
export function encodePrivilege(resource, action) {
  if (typeof action === 'string' && action.includes(':')) {
    throw new Error(`Invalid privilege action "${action}": actions must not contain ':'`);
  }
  return `${resource}:${action}`;
}
