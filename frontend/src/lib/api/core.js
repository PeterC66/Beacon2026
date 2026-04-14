// api/core.js — Request infrastructure, auth token management, blob/multipart helpers.
// All other api modules import from here.

export const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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
export function getTenantSlug()  { return tenantSlug; }

// ─── Core fetch wrapper ───────────────────────────────────────────────────

export async function request(path, options = {}, retry = true) {
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

/**
 * Attempt to restore a session using the httpOnly refresh cookie.
 * Unlike tryRefresh(), this works before tenantSlug is set — the caller
 * provides the slug (e.g. from the beacon_last_u3a cookie).
 * Returns { accessToken, user } on success, or null.
 */
export async function restoreSession(slug) {
  if (!slug) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-tenant-slug': slug },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      accessToken = data.accessToken;
      tenantSlug  = slug;
      return data;
    }
  } catch {}
  return null;
}

export class ApiError extends Error {
  constructor(message, status, body = {}) {
    super(message);
    this.status = status;
    this.body   = body;
  }
}

/** Fetch a binary blob with auth headers (does NOT auto-download like requestBlob). */
export async function fetchAuthBlob(path) {
  const headers = {
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...(tenantSlug  && { 'x-tenant-slug': tenantSlug }),
  };
  const res = await fetch(`${BASE}${path}`, { headers, credentials: 'include' });
  if (!res.ok) return null;
  return res.blob();
}

/** Download an export as a blob (sends auth header, triggers browser download).
 *  Filename is read from the server's Content-Disposition header.
 *  Accepts optional fetch options (method, body, extra headers) for POST downloads. */
export async function requestBlob(path, options = {}) {
  const headers = {
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...(tenantSlug  && { 'x-tenant-slug': tenantSlug }),
    ...options.headers,
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status, body);
  }
  let filename = 'download.xlsx';
  const cd = res.headers.get('Content-Disposition');
  if (cd) {
    const m = cd.match(/filename="([^"]+)"/);
    if (m) filename = m[1];
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Upload a backup file (multipart) — no Content-Type header so browser sets it with boundary */
export async function requestMultipart(path, formData) {
  const headers = {
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...(tenantSlug  && { 'x-tenant-slug': tenantSlug }),
  };
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', body: formData, headers, credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status, body);
  }
  return res.json();
}
