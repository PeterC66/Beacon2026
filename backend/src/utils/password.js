// beacon2026/backend/src/utils/password.js
// Password hashing and verification using bcrypt

import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

export async function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken() {
  return randomBytes(48).toString('hex');
}

// Fast hash for high-entropy opaque tokens (reset/payment tokens) that we
// only store to look up by equality. Bcrypt is unnecessary — the input is
// 48+ hex chars of crypto-random bytes, not a guessable password — and would
// add latency to every lookup. SHA-256 of the raw token gives a fixed 64-char
// hex digest that's safe to store in a TEXT column.
export function hashOpaqueToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
