// beacon2/backend/src/utils/passwordPolicy.js
// Single source of truth for the password-strength policy and temporary-
// password generation, so every flow (admin change, force-change, user
// create/update, tenant create, and all portal reset/register flows) enforces
// the same rules. Kept separate from password.js — which several test files
// mock wholesale — so importing the schema never depends on that mock.

import crypto from 'crypto';
import { z } from 'zod';

// Canonical password rules: 10–72 chars (72 is bcrypt's input limit) with at
// least one lowercase, one uppercase, and one digit. Apply everywhere a user
// chooses a password.
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .refine((pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw), {
    message:
      'Password must contain at least one uppercase, one lowercase, and one numeric character.',
  });

// Alphabet for generated temporary passwords — omits easily-confused
// characters (0/O, 1/I/l). These are set with must_change_password = true, so
// they are not validated against passwordSchema; the user replaces them on
// first login.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

/**
 * Generate a random temporary password. Uses crypto.randomInt for a uniform
 * index into the alphabet — unlike `randomBytes()[i] % length`, which is
 * modulo-biased when the alphabet length does not divide 256.
 */
export function generateTempPassword(length = 12) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[crypto.randomInt(TEMP_PASSWORD_CHARS.length)];
  }
  return out;
}
