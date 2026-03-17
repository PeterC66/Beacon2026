// beacon2/e2e/global-setup.js
// Runs once before all Playwright tests.
// Creates (or resets) the dedicated E2E test tenant, then seeds the minimum
// reference data that every test expects to find (finance account, etc.).
//
// The four default member statuses (Current / Lapsed / Resigned / Deceased)
// and the default "Individual" member class are seeded automatically when a
// tenant is created — no manual seeding needed for those.

import { config as loadDotenv } from 'dotenv';
loadDotenv();

const API   = process.env.BEACON2_API_URL   ?? 'http://localhost:3001';
const SLUG  = process.env.BEACON2_TEST_TENANT_SLUG  ?? 'e2etest';
const NAME  = process.env.BEACON2_TEST_TENANT_NAME  ?? 'E2E Test u3a';
const SADM_USER = process.env.BEACON2_SYSADMIN_USERNAME ?? 'sysadmin';
const SADM_PASS = process.env.BEACON2_SYSADMIN_PASSWORD ?? 'changeme';
const ADM_USER  = process.env.BEACON2_TEST_ADMIN_USERNAME ?? 'testadmin';
const ADM_PASS  = process.env.BEACON2_TEST_ADMIN_PASSWORD ?? 'TestAdmin99!';
const ADM_NAME  = process.env.BEACON2_TEST_ADMIN_NAME     ?? 'Test Administrator';
const ADM_EMAIL = process.env.BEACON2_TEST_ADMIN_EMAIL    ?? 'testadmin@beacon2-e2e.invalid';

// ── Helpers ──────────────────────────────────────────────────────────────

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
    body: { username: SADM_USER, password: SADM_PASS },
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

// ── Step 5: seed a second member class ───────────────────────────────────
// Tests that add/delete classes need a deletable one (the default "Individual"
// is locked). Seed a "Joint" class so tests have something to work with.

async function seedMemberClass(tenantToken) {
  const { status } = await apiCall('/member-classes', {
    method: 'POST',
    token: tenantToken,
    tenantSlug: SLUG,
    body: { name: 'Joint', current: true, fee: '20.00', giftAidFee: '0.00' },
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

  const sysToken    = await sysAdminLogin();
  await ensureTestTenant(sysToken);
  const tenantToken = await tenantAdminLogin();
  await seedFinanceAccount(tenantToken);
  await seedMemberClass(tenantToken);

  console.log('[setup] Global setup complete.\n');
}
