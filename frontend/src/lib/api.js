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
  login:   (tenantSlug, username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ tenantSlug, username, password }) }),
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

// ─── Member classes ───────────────────────────────────────────────────────

export const memberClasses = {
  list:   ()         => request('/member-classes'),
  get:    (id)       => request(`/member-classes/${id}`),
  create: (data)     => request('/member-classes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/member-classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/member-classes/${id}`, { method: 'DELETE' }),
};

// ─── Member statuses ──────────────────────────────────────────────────────

export const memberStatuses = {
  list:   ()         => request('/member-statuses'),
  create: (data)     => request('/member-statuses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/member-statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/member-statuses/${id}`, { method: 'DELETE' }),
};

// ─── Members ──────────────────────────────────────────────────────────────

export const members = {
  list:    (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status)  qs.set('status',  params.status);
    if (params.classId) qs.set('classId', params.classId);
    if (params.q)       qs.set('q',       params.q);
    if (params.letter)  qs.set('letter',  params.letter);
    const query = qs.toString();
    return request(`/members${query ? '?' + query : ''}`);
  },
  get:     (id)              => request(`/members/${id}`),
  create:  (data, confirmed) =>
    request(`/members${confirmed ? '?confirmed=1' : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  update:  (id, data)        => request(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:  (id)              => request(`/members/${id}`, { method: 'DELETE' }),
};

// ─── Faculties ────────────────────────────────────────────────────────────

export const faculties = {
  list:   ()         => request('/faculties'),
  create: (data)     => request('/faculties', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/faculties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/faculties/${id}`, { method: 'DELETE' }),
};

// ─── Groups ───────────────────────────────────────────────────────────────

export const groups = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.activeOnly !== undefined) qs.set('activeOnly', params.activeOnly ? 'true' : 'false');
    if (params.facultyId) qs.set('facultyId', params.facultyId);
    if (params.letter)    qs.set('letter',    params.letter);
    const query = qs.toString();
    return request(`/groups${query ? '?' + query : ''}`);
  },
  get:    (id)       => request(`/groups/${id}`),
  create: (data)     => request('/groups', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/groups/${id}`, { method: 'DELETE' }),

  listMembers:  (id, params = {}) => {
    const qs = new URLSearchParams();
    if (params.showWaiting !== undefined) qs.set('showWaiting', params.showWaiting ? 'true' : 'false');
    const query = qs.toString();
    return request(`/groups/${id}/members${query ? '?' + query : ''}`);
  },
  addMember:    (id, data)           => request(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (id, memberId, data) => request(`/groups/${id}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeMember: (id, memberId)       => request(`/groups/${id}/members/${memberId}`, { method: 'DELETE' }),
};

// ─── Finance ──────────────────────────────────────────────────────────────

export const finance = {
  listAccounts:   ()         => request('/finance/accounts'),
  createAccount:  (data)     => request('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount:  (id, data) => request(`/finance/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount:  (id)       => request(`/finance/accounts/${id}`, { method: 'DELETE' }),

  listCategories:   ()         => request('/finance/categories'),
  createCategory:   (data)     => request('/finance/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory:   (id, data) => request(`/finance/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory:   (id)       => request(`/finance/categories/${id}`, { method: 'DELETE' }),

  listTransactions: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.accountId)  qs.set('accountId',  params.accountId);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.groupId)    qs.set('groupId',    params.groupId);
    if (params.year)       qs.set('year',       String(params.year));
    const query = qs.toString();
    return request(`/finance/transactions${query ? '?' + query : ''}`);
  },
  getTransaction:    (id)       => request(`/finance/transactions/${id}`),
  createTransaction: (data)     => request('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/finance/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTransaction: (id)       => request(`/finance/transactions/${id}`, { method: 'DELETE' }),
};

// ─── Settings ─────────────────────────────────────────────────────────────

export const settings = {
  get:    ()     => request('/settings'),
  update: (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── System admin (separate token, no tenant) ─────────────────────────────

export const system = {
  login: (email, password) =>
    fetch(`${BASE}/auth/system/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),

  listTenants: (token) =>
    fetch(`${BASE}/system/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),

  createTenant: (token, data) =>
    fetch(`${BASE}/system/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),

  setTenantActive: (token, id, active) =>
    fetch(`${BASE}/system/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active }),
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),
};
