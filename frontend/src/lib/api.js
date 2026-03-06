// beacon2/frontend/src/lib/api.js
// Central API client. All backend calls go through here.
// Automatically attaches the Bearer token and handles token refresh.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

let accessToken = null;   // stored in memory only — never localStorage
let tenantSlug  = null;

export function setAuth(token, slug) {
  accessToken = token;
  tenantSlug  = slug;
}

export function clearAuth() {
  accessToken = null;
  tenantSlug  = null;
}

export function getAccessToken() { return accessToken; }

// ─── Core fetch wrapper ───────────────────────────────────────────────────

async function request(path, options = {}, retry = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...(tenantSlug  && { 'x-tenant-slug': tenantSlug }),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',   // send httpOnly refresh token cookie
  });

  // Token expired — try refreshing once
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, options, false);  // retry with new token
    } else {
      // Force logout
      clearAuth();
      window.dispatchEvent(new Event('auth:expired'));
      throw new ApiError('Session expired. Please log in again.', 401);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status, body);
  }

  return res.status === 204 ? null : res.json();
}

async function tryRefresh() {
  if (!tenantSlug) return false;
  try {
    const data = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-tenant-slug': tenantSlug },
    }).then((r) => (r.ok ? r.json() : null));

    if (data?.accessToken) {
      accessToken = data.accessToken;
      return true;
    }
  } catch {}
  return false;
}

export class ApiError extends Error {
  constructor(message, status, body = {}) {
    super(message);
    this.status = status;
    this.body   = body;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export const auth = {
  login:   (tenantSlug, email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ tenantSlug, email, password }) }),
  logout:  () =>
    request('/auth/logout', { method: 'POST' }),
  refresh: () =>
    request('/auth/refresh', { method: 'POST' }),
};

// ─── Users ────────────────────────────────────────────────────────────────

export const users = {
  list:        ()         => request('/users'),
  get:         (id)       => request(`/users/${id}`),
  create:      (data)     => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update:      (id, data) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:      (id)       => request(`/users/${id}`, { method: 'DELETE' }),
  assignRole:  (id, roleId) =>
    request(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ roleId }) }),
  removeRole:  (id, roleId) =>
    request(`/users/${id}/roles/${roleId}`, { method: 'DELETE' }),
};

// ─── Roles ────────────────────────────────────────────────────────────────

export const roles = {
  list:            ()              => request('/roles'),
  get:             (id)            => request(`/roles/${id}`),
  create:          (data)          => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  update:          (id, data)      => request(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:          (id)            => request(`/roles/${id}`, { method: 'DELETE' }),
  setPrivileges:   (id, privileges) =>
    request(`/roles/${id}/privileges`, { method: 'PUT', body: JSON.stringify({ privileges }) }),
};

// ─── Privileges ───────────────────────────────────────────────────────────

export const privileges = {
  resources: () => request('/privileges/resources'),
};
