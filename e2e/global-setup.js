// beacon2/e2e/global-setup.js
// Runs once before all Playwright tests.
// Creates (or resets) the dedicated E2E test tenant, then seeds the minimum
// reference data that every test expects to find (finance account, etc.).
//
// The four default member statuses (Current / Lapsed / Resigned / Deceased)
// and the default "Individual" member class are seeded automatically when a
// tenant is created — no manual seeding needed for those.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
loadDotenv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '.e2e-state.json');

const API   = process.env.BEACON2_API_URL             || 'http://localhost:3001';
// Generate a short unique suffix (last 6 hex chars of timestamp) so parallel or
// repeated runs don't collide on the slug.  Override via env var if a fixed slug
// is preferred.
const RUN_ID = Date.now().toString(16).slice(-6);
const SLUG  = process.env.BEACON2_TEST_TENANT_SLUG    || `e2e_${RUN_ID}`;
const NAME  = process.env.BEACON2_TEST_TENANT_NAME    || `E2E Test u3a ${RUN_ID}`;
const SADM_EMAIL = process.env.BEACON2_SYSADMIN_EMAIL    || 'admin@beacon2.example';
const SADM_PASS  = process.env.BEACON2_SYSADMIN_PASSWORD || 'changeme';
const ADM_USER  = process.env.BEACON2_TEST_ADMIN_USERNAME || 'testadmin';
const ADM_PASS  = process.env.BEACON2_TEST_ADMIN_PASSWORD || 'TestAdmin99!';
const ADM_NAME  = process.env.BEACON2_TEST_ADMIN_NAME     || 'Test Administrator';
const ADM_EMAIL = process.env.BEACON2_TEST_ADMIN_EMAIL    || 'testadmin@beacon2-e2e.invalid';

const BASE_URL = process.env.BEACON2_BASE_URL || 'http://localhost:5173';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Poll a URL until it responds (handles Render free-tier cold starts).
 *  Any HTTP response (including 404) counts as "alive" — we just need the
 *  server process to be accepting connections. */
async function waitForService(url, label, maxWaitMs = 120_000) {
  const start = Date.now();
  const interval = 5_000;
  console.log(`[setup] Waiting for ${label} at ${url} …`);
  while (Date.now() - start < maxWaitMs) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(10_000) });
      // Any response means the service is up
      console.log(`[setup] ${label} is ready (${Math.round((Date.now() - start) / 1000)}s).`);
      return;
    } catch { /* not ready yet — network error / timeout */ }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`${label} at ${url} did not respond within ${maxWaitMs / 1000}s`);
}

async function apiCall(path, { method = 'GET', body, token, tenantSlug } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token)      headers['Authorization'] = `Bearer ${token}`;
  if (tenantSlug) headers['x-tenant-slug'] = tenantSlug;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }

  return { status: res.status, body: json };
}

// ── Step 1: system-admin login ────────────────────────────────────────────

async function sysAdminLogin() {
  const { status, body } = await apiCall('/auth/system/login', {
    method: 'POST',
    body: { email: SADM_EMAIL, password: SADM_PASS },
  });
  if (status !== 200) {
    throw new Error(`System-admin login failed (${status}): ${JSON.stringify(body)}`);
  }
  console.log('[setup] System admin logged in.');
  return body.accessToken;
}

// ── Step 2: create or reset the test tenant ───────────────────────────────

async function ensureTestTenant(sysToken) {
  // Try to create
  const { status, body } = await apiCall('/system/tenants', {
    method: 'POST',
    token: sysToken,
    body: {
      name:          NAME,
      slug:          SLUG,
      adminEmail:    ADM_EMAIL,
      adminName:     ADM_NAME,
      adminPassword: ADM_PASS,
      adminUsername: ADM_USER,
    },
  });

  if (status === 201) {
    console.log(`[setup] Test tenant created: ${NAME} (${SLUG})`);
    return body;
  }

  if (status === 409) {
    // Already exists — find its ID and reset the admin password so tests
    // always start with known credentials, even after a previous failed run.
    console.log(`[setup] Test tenant already exists — resetting admin password.`);
    const { status: listStatus, body: tenants } = await apiCall('/system/tenants', { token: sysToken });
    if (listStatus !== 200) throw new Error(`Cannot list tenants (${listStatus})`);
    const tenant = tenants.find((t) => t.slug === SLUG);
    if (!tenant) throw new Error(`Test tenant not found in list after 409`);

    const { status: pwStatus, body: pwBody } = await apiCall(`/system/tenants/${tenant.id}/set-temp-password`, {
      method: 'POST',
      token: sysToken,
      body:  { password: ADM_PASS },
    });
    if (pwStatus !== 200) throw new Error(`Password reset failed (${pwStatus}): ${JSON.stringify(pwBody)}`);
    console.log('[setup] Admin password reset.');
    return tenant;
  }

  throw new Error(`Unexpected status creating tenant (${status}): ${JSON.stringify(body)}`);
}

// ── Step 3: tenant-admin login ────────────────────────────────────────────

async function tenantAdminLogin() {
  const { status, body } = await apiCall('/auth/login', {
    method: 'POST',
    body: { tenantSlug: SLUG, username: ADM_USER, password: ADM_PASS },
  });
  if (status !== 200) {
    throw new Error(`Tenant admin login failed (${status}): ${JSON.stringify(body)}`);
  }
  console.log('[setup] Tenant admin logged in.');
  return body.accessToken;
}

// ── Step 4: seed a default finance account ────────────────────────────────
// Member-creation tests record a payment that requires a finance account.
// We create "Current Account" (ignoring 409 if it already exists).

async function seedFinanceAccount(tenantToken) {
  const { status } = await apiCall('/finance/accounts', {
    method: 'POST',
    token: tenantToken,
    tenantSlug: SLUG,
    body: { name: 'Current Account', active: true },
  });
  if (status === 201) {
    console.log('[setup] Finance account "Current Account" created.');
  } else if (status === 409) {
    console.log('[setup] Finance account already exists — skipping.');
  } else {
    // Non-fatal: log and continue (finance tests will handle their own data)
    console.warn(`[setup] Finance account creation returned ${status} — continuing.`);
  }
}

// ── Step 5: seed a "Membership" finance category ─────────────────────────
// Member-creation tests that include a payment need an active finance
// category named "Membership" (or "Donations") so the backend can allocate
// the payment to a transaction_categories row.

async function seedFinanceCategory(tenantToken) {
  const { status } = await apiCall('/finance/categories', {
    method: 'POST',
    token: tenantToken,
    tenantSlug: SLUG,
    body: { name: 'Membership', active: true, sort_order: 1 },
  });
  if (status === 201) {
    console.log('[setup] Finance category "Membership" created.');
  } else if (status === 409) {
    console.log('[setup] Finance category already exists — skipping.');
  } else {
    console.warn(`[setup] Finance category creation returned ${status} — continuing.`);
  }
}

// ── Step 6: seed a second member class ───────────────────────────────────
// Tests that add/delete classes need a deletable one (the default "Individual"
// is locked). Seed a "Joint" class so tests have something to work with.

async function seedMemberClass(tenantToken) {
  const { status } = await apiCall('/member-classes', {
    method: 'POST',
    token: tenantToken,
    tenantSlug: SLUG,
    body: { name: 'Joint', current: true, fee: 20, giftAidFee: 0 },
  });
  if (status === 201) {
    console.log('[setup] Member class "Joint" created.');
  } else {
    console.log('[setup] Member class "Joint" already exists or could not be created — continuing.');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

export default async function globalSetup() {
  console.log('\n[setup] Beacon2 E2E global setup starting…');
  console.log(`[setup]   API URL    : ${API}`);
  console.log(`[setup]   Tenant slug: ${SLUG}`);
  console.log(`[setup]   Admin user : ${ADM_USER}`);

  // Warm up both frontend and backend (Render free-tier cold starts)
  await Promise.all([
    waitForService(BASE_URL, 'Frontend'),
    waitForService(`${API}/health`, 'Backend'),
  ]);

  // Log deployed version so CI output shows exactly what was tested.
  try {
    const healthRes = await fetch(`${API}/health`, { signal: AbortSignal.timeout(10_000) });
    const health = await healthRes.json();
    console.log(`[setup]   Backend version : v${health.version ?? 'unknown'}`);
  } catch { console.log('[setup]   Backend version : unknown (health check failed)'); }

  const sysToken    = await sysAdminLogin();
  await ensureTestTenant(sysToken);
  const tenantToken = await tenantAdminLogin();
  await seedFinanceAccount(tenantToken);
  await seedFinanceCategory(tenantToken);
  await seedMemberClass(tenantToken);

  // Persist the generated slug so test fixtures and teardown can read it.
  writeFileSync(STATE_PATH, JSON.stringify({ slug: SLUG }));

  // Write a storageState file that pre-sets the cookie consent cookie.
  // This prevents the cookie consent modal from blocking form interaction
  // in every test.
  const baseURL = new URL(BASE_URL);
  const storageState = {
    cookies: [{
      name: 'beacon2_cookie_consent',
      value: 'accepted',
      domain: baseURL.hostname,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }],
    origins: [],
  };
  writeFileSync(resolve(__dirname, '.e2e-storage.json'), JSON.stringify(storageState));

  console.log('[setup] Global setup complete.\n');
}
