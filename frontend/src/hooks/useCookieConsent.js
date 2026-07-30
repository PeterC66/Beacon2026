// beacon2026/frontend/src/hooks/useCookieConsent.js
// Manages cookie consent state. The consent choice itself is stored in an
// essential cookie (beacon2026_cookie_consent) — this is permitted because it
// records the user's preference about cookies, not optional data.

import { CONSENT_GATED_LOCAL_KEYS } from '../lib/storageKeys.js';

const CONSENT_COOKIE = 'beacon2026_cookie_consent';
const CONSENT_DAYS = 365;

function readCookie(name) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function writeCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/**
 * Returns the current consent value: 'accepted', 'declined', or null (not yet chosen).
 */
export function getConsentValue() {
  return readCookie(CONSENT_COOKIE);
}

/**
 * Returns true if the user has accepted optional cookies.
 * Used by Login.jsx and usePreferences.js to gate optional storage.
 */
export function hasOptionalCookieConsent() {
  return getConsentValue() === 'accepted';
}

/**
 * Record the user's consent choice and clean up if declined.
 */
export function setConsent(accepted) {
  writeCookie(CONSENT_COOKIE, accepted ? 'accepted' : 'declined', CONSENT_DAYS);

  if (!accepted) {
    // Remove optional cookies
    deleteCookie('beacon_last_u3a');
    // Remove optional localStorage
    try {
      for (const key of CONSENT_GATED_LOCAL_KEYS) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  // Notify listeners (e.g. CookieConsent component)
  window.dispatchEvent(new Event('beacon2026-consent-changed'));
}
