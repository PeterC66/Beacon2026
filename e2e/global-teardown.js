// beacon2/e2e/global-teardown.js
// Deletes the test tenant after all tests run — but ONLY if they all passed.
// The success-reporter.js writes a .e2e-passed marker file on a clean run;
// if that file is absent (failures occurred), the tenant is preserved so you
// can inspect the data.

import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
loadDotenv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH  = resolve(__dirname, '.e2e-state.json');
const PASSED_PATH = resolve(__dirname, '.e2e-passed');

function readSlug() {
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    return state.slug;
  } catch { /* state file missing — use env/default */ }
  return process.env.BEACON2_TEST_TENANT_SLUG || 'e2etest';
}

const API       = process.env.BEACON2_API_URL || 'http://localhost:3001';
const SLUG      = readSlug();
const SADM_USER = process.env.BEACON2_SYSADMIN_USERNAME || 'sysadmin';
const SADM_PASS = process.env.BEACON2_SYSADMIN_PASSWORD || 'changeme';

async function apiCall(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export default async function globalTeardown() {
  // Only delete the tenant if every test passed
  if (!existsSync(PASSED_PATH)) {
    console.log('\n[teardown] Tests had failures — keeping test tenant for inspection.');
    return;
  }

  console.log('\n[teardown] All tests passed — deleting test tenant…');
  const { body: loginBody } = await apiCall('/auth/system/login', {
    method: 'POST',
    body: { username: SADM_USER, password: SADM_PASS },
  });
  const sysToken = loginBody?.accessToken;
  if (!sysToken) { console.warn('[teardown] Could not log in — skipping delete.'); return; }

  const { body: tenants } = await apiCall('/system/tenants', { token: sysToken });
  const tenant = Array.isArray(tenants) && tenants.find((t) => t.slug === SLUG);
  if (!tenant) { console.log('[teardown] Test tenant not found — nothing to delete.'); return; }

  const { status } = await apiCall(`/system/tenants/${tenant.id}`, { method: 'DELETE', token: sysToken });
  console.log(`[teardown] Delete status: ${status}`);

  // Clean up marker and state files
  try { unlinkSync(PASSED_PATH); } catch { /* already gone */ }
  try { unlinkSync(STATE_PATH); } catch { /* already gone */ }
}
