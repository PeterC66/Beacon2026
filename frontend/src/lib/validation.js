// Shared frontend validation utilities.
// Centralises postcode and phone validation that was previously duplicated
// across MemberEditor, MemberValidator, and JoinForm.

import { isValidPhoneNumber } from 'libphonenumber-js';
import { UK_POSTCODE_RE } from './constants.js';

/** Returns true if value is a valid UK postcode. */
export function isValidUKPostcode(value) {
  return UK_POSTCODE_RE.test(value.trim());
}

/**
 * Validate a UK phone number.
 * @returns {string|null} Error message or null if valid/empty.
 */
export function validatePhone(value) {
  if (!value || !value.trim()) return null;
  try {
    return isValidPhoneNumber(value, 'GB') ? null : 'Enter a valid UK phone number';
  } catch {
    return 'Enter a valid UK phone number';
  }
}
