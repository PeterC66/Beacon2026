// api/system.js — System admin API (separate token, no tenant context).
// Uses raw fetch() because system-admin auth is a separate token, distinct
// from the tenant accessToken managed in core.js. Token is held in memory
// only — never in localStorage or sessionStorage — so XSS cannot steal it.

import { BASE } from './core.js';

let sysToken = null;

export function setSysToken(token) { sysToken = token; }
export function clearSysToken()     { sysToken = null; }
export function getSysToken()       { return sysToken; }
export function hasSysToken()       { return !!sysToken; }

function systemFetch(url, options = {}) {
  return fetch(url, options).then((r) =>
    r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
  );
}

export const system = {
  login: (email, password) =>
    systemFetch(`${BASE}/auth/system/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  listTenants: (token) =>
    systemFetch(`${BASE}/system/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createTenant: (token, data) =>
    systemFetch(`${BASE}/system/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  setTenantActive: (token, id, active) =>
    systemFetch(`${BASE}/system/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active }),
    }),

  restoreBackup: (token, tenantSlug, file) => {
    const form = new FormData();
    form.append('backup', file);
    return systemFetch(`${BASE}/system/restore/${tenantSlug}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  },

  deleteTenant: (token, id) =>
    systemFetch(`${BASE}/system/tenants/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  setTempPassword: (token, id, password) =>
    systemFetch(`${BASE}/system/tenants/${id}/set-temp-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    }),

  getSettings: (token) =>
    systemFetch(`${BASE}/system/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateSettings: (token, data) =>
    systemFetch(`${BASE}/system/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  getFeatureConfig: (token, slug) =>
    systemFetch(`${BASE}/system/tenants/${slug}/feature-config`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateFeatureConfig: (token, slug, data) =>
    systemFetch(`${BASE}/system/tenants/${slug}/feature-config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
};
