// beacon2/frontend/src/hooks/usePreferences.js
// Per-user display preferences stored in localStorage.
// Mirrors the "Personal Preferences" settings from Beacon doc 9.1(a).

const KEY = 'beacon2_prefs';

const DEFAULTS = {
  sortBy:            'surname',       // 'surname' | 'forename'
  displayFormat:     'surname_first', // 'surname_first' | 'forename_first'
  inactivityTimeout: 20,              // minutes (5–99)
  textSize:          'normal',        // 'small' | 'normal' | 'large' | 'xlarge'
  colorTheme:        'default',       // 'default' | 'high-contrast'
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event('beacon2-prefs-changed'));
  } catch { /* ignore */ }
}

/**
 * Returns current preferences (plain object, not reactive).
 * Call getPreferences() at component mount if you need a snapshot.
 */
export function getPreferences() { return load(); }

/**
 * Save updated preferences. Pass a partial object; unrecognised keys are ignored.
 */
export function savePreferences(updates) {
  const current = load();
  const next = { ...current };
  if (updates.sortBy           !== undefined) next.sortBy           = updates.sortBy;
  if (updates.displayFormat    !== undefined) next.displayFormat    = updates.displayFormat;
  if (updates.inactivityTimeout !== undefined) {
    const n = parseInt(updates.inactivityTimeout, 10);
    next.inactivityTimeout = (!isNaN(n) && n >= 5 && n <= 99) ? n : DEFAULTS.inactivityTimeout;
  }
  if (updates.textSize !== undefined) {
    const valid = ['small', 'normal', 'large', 'xlarge'];
    next.textSize = valid.includes(updates.textSize) ? updates.textSize : DEFAULTS.textSize;
  }
  if (updates.colorTheme !== undefined) {
    const valid = ['default', 'high-contrast'];
    next.colorTheme = valid.includes(updates.colorTheme) ? updates.colorTheme : DEFAULTS.colorTheme;
  }
  save(next);
  return next;
}

/**
 * Format a member's name according to current display preferences.
 * member: { forenames, surname } or { member_forenames, member_surname }
 */
export function formatMemberName(member) {
  const prefs = load();
  const fore = member.forenames ?? member.member_forenames ?? '';
  const sur  = member.surname   ?? member.member_surname   ?? '';
  if (prefs.displayFormat === 'forename_first') return `${fore} ${sur}`.trim();
  return `${sur}, ${fore}`.trim();
}
