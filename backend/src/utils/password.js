// beacon2/backend/src/utils/password.js
// Password hashing and verification using bcrypt

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

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
