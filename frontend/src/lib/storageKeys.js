// beacon2026/frontend/src/lib/storageKeys.js
// Central definitions for sessionStorage / localStorage keys.
// These strings are shared across many files (e.g. 'emailComposeMemberIds' is
// written by ~10 list pages and read by EmailCompose), so a typo in any one of
// them silently breaks a hand-off. Import the constant instead of the literal.

// ── sessionStorage (cleared when the tab closes) ──────────────────────────
// Cross-page hand-off of the selected member IDs to the compose pages.
export const SS_EMAIL_COMPOSE_MEMBER_IDS = 'emailComposeMemberIds';
export const SS_LETTER_COMPOSE_MEMBER_IDS = 'letterComposeMemberIds';
// Gift-aid date range handed to the email composer.
export const SS_EMAIL_GIFT_AID_DATES = 'emailGiftAidDates';
// Online-join result handed to the JoinComplete page.
export const SS_JOIN_RESULT = 'joinResult';
// Portal member context (set at portal login).
export const SS_PORTAL_MEMBER = 'portalMember';
export const SS_PORTAL_SLUG = 'portalSlug';

// ── localStorage (persists across sessions; gated by cookie consent) ───────
export const LS_PREFS = 'beacon2026_prefs';
export const LS_LABEL_SETTINGS = 'beacon2026_label_settings';
export const LS_LAST_EXPORT_CLASS = 'beacon2026_last_export_class';
export const LS_TAM_SUBMISSION = 'beacon2026_tam_submission';
export const LS_EMAIL_COMPOSE_PREFS = 'beacon2026_email_compose_prefs';

// Convenience list of the consent-gated localStorage keys, so cookie-consent
// withdrawal can clear them all without re-listing the literals.
export const CONSENT_GATED_LOCAL_KEYS = [
  LS_PREFS,
  LS_LABEL_SETTINGS,
  LS_LAST_EXPORT_CLASS,
  LS_EMAIL_COMPOSE_PREFS,
];
