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
async function fetchAuthBlob(path) {
  const headers = {
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...(tenantSlug  && { 'x-tenant-slug': tenantSlug }),
  };
  const res = await fetch(`${BASE}${path}`, { headers, credentials: 'include' });
  if (!res.ok) return null;
  return res.blob();
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export const auth = {
  login:          (tenantSlug, username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ tenantSlug, username, password }) }),
  logout:         () =>
    request('/auth/logout', { method: 'POST' }),
  refresh:        () =>
    request('/auth/refresh', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  forceChangePassword: (newPassword, question, answer) =>
    request('/auth/force-change-password', { method: 'POST', body: JSON.stringify({ newPassword, question, answer }) }),
  recover:        (tenantSlug, forename, surname, postcode, email) =>
    request('/auth/recover', { method: 'POST', body: JSON.stringify({ tenantSlug, forename, surname, postcode, email }) }),
  recoverVerify:  (tenantSlug, userId, answer) =>
    request('/auth/recover/verify', { method: 'POST', body: JSON.stringify({ tenantSlug, userId, answer }) }),
  updateQA:       (question, answer) =>
    request('/auth/qa', { method: 'PATCH', body: JSON.stringify({ question, answer }) }),
  getQA:          () =>
    request('/auth/qa'),
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
  setTempPassword: (id) =>
    request(`/users/${id}/set-temp-password`, { method: 'POST' }),
  availableMembers: () => request('/users/available-members'),
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
  list:            ()         => request('/member-classes'),
  get:             (id)       => request(`/member-classes/${id}`),
  create:          (data)     => request('/member-classes', { method: 'POST', body: JSON.stringify(data) }),
  update:          (id, data) => request(`/member-classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:          (id)       => request(`/member-classes/${id}`, { method: 'DELETE' }),
  getMonthlyFees:  (id)       => request(`/member-classes/${id}/monthly-fees`),
  saveMonthlyFees: (id, data) => request(`/member-classes/${id}/monthly-fees`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Member statuses ──────────────────────────────────────────────────────

export const memberStatuses = {
  list:   ()         => request('/member-statuses'),
  create: (data)     => request('/member-statuses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/member-statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/member-statuses/${id}`, { method: 'DELETE' }),
};

// ─── Address Export ───────────────────────────────────────────────────────────

export const addressExport = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status)     qs.set('status',     params.status);
    if (params.classId)    qs.set('classId',    params.classId);
    if (params.pollId)     qs.set('pollId',     params.pollId);
    if (params.negatePoll) qs.set('negatePoll', params.negatePoll);
    if (params.groupId)    qs.set('groupId',    params.groupId);
    const query = qs.toString();
    return request(`/address-export${query ? '?' + query : ''}`);
  },
};

// ─── Members ──────────────────────────────────────────────────────────────

export const members = {
  list:    (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status)      qs.set('status',      params.status);
    if (params.classId)     qs.set('classId',      params.classId);
    if (params.pollId)      qs.set('pollId',       params.pollId);
    if (params.negatePoll)  qs.set('negatePoll',   '1');
    if (params.q)           qs.set('q',            params.q);
    if (params.cf)            qs.set('cf',            params.cf);
    if (params.letter)        qs.set('letter',        params.letter);
    if (params.paymentMethod) qs.set('paymentMethod',  params.paymentMethod);
    const query = qs.toString();
    return request(`/members${query ? '?' + query : ''}`);
  },
  get:      (id)              => request(`/members/${id}`),
  validate: ()               => request('/members/validate'),
  recent:   (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to)   qs.set('to',   params.to);
    return request(`/members/recent${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  statistics: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to)   qs.set('to',   params.to);
    return request(`/members/statistics${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  listRenewals:    ()        => request('/members/renewals'),
  renew:           (data)    => request('/members/renew', { method: 'POST', body: JSON.stringify(data) }),
  listNonRenewals: (mode)    => request(`/members/non-renewals?mode=${mode}`),
  lapse:           (memberIds) => request('/members/lapse', { method: 'POST', body: JSON.stringify({ memberIds }) }),
  download: (format, ids, fields) => {
    const qs = new URLSearchParams({ format, ids: ids.join(','), fields: fields.join(',') });
    return requestBlob(`/members/download?${qs}`);
  },
  create:   (data, confirmed) =>
    request(`/members${confirmed ? '?confirmed=1' : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  update:   (id, data)        => request(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:   (id)              => request(`/members/${id}`, { method: 'DELETE' }),
  getGroups: (id)             => request(`/members/${id}/groups`),
  uploadPhoto: (id, data, mimeType) =>
    request(`/members/${id}/photo`, { method: 'POST', body: JSON.stringify({ data, mimeType }) }),
  deletePhoto: (id)           => request(`/members/${id}/photo`, { method: 'DELETE' }),
  getPhotoBlob: (id) => fetchAuthBlob(`/members/${id}/photo`),
};

// ─── Faculties ────────────────────────────────────────────────────────────

export const faculties = {
  list:   ()         => request('/faculties'),
  create: (data)     => request('/faculties', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/faculties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/faculties/${id}`, { method: 'DELETE' }),
};

// ─── Venues ───────────────────────────────────────────────────────────────

export const venues = {
  list:   ()         => request('/venues'),
  get:    (id)       => request(`/venues/${id}`),
  create: (data)     => request('/venues', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/venues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id)       => request(`/venues/${id}`, { method: 'DELETE' }),
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
  download: (format, ids, fields) => {
    const qs = new URLSearchParams({ format, ids: ids.join(','), fields: fields.join(',') });
    return requestBlob(`/groups/download?${qs}`);
  },
  bulkAddMembers: (id, memberIds) =>
    request(`/groups/${id}/members/bulk`, { method: 'POST', body: JSON.stringify({ memberIds }) }),
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
  downloadMembers: (id, format, ids, fields) => {
    const qs = new URLSearchParams({ format, ids: ids.join(','), fields: fields.join(',') });
    return requestBlob(`/groups/${id}/members/download?${qs}`);
  },
  bulkRemoveMembers: (id, memberIds) =>
    request(`/groups/${id}/members/bulk`, { method: 'DELETE', body: JSON.stringify({ memberIds }) }),
  bulkAddToGroup: (id, targetGroupId, memberIds) =>
    request(`/groups/${id}/members/bulk-add`, { method: 'POST', body: JSON.stringify({ memberIds, targetGroupId }) }),

  listEvents:   (id)             => request(`/groups/${id}/events`),
  createEvents: (id, data)       => request(`/groups/${id}/events`, { method: 'POST', body: JSON.stringify(data) }),
  updateEvent:  (id, evId, data) => request(`/groups/${id}/events/${evId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEvents: (id, ids)        => request(`/groups/${id}/events`, { method: 'DELETE', body: JSON.stringify({ ids }) }),

  getLedger: (id, params = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to)   qs.set('to',   params.to);
    const query = qs.toString();
    return request(`/groups/${id}/ledger${query ? '?' + query : ''}`);
  },
  createLedgerEntry:  (id, data)          => request(`/groups/${id}/ledger`, { method: 'POST', body: JSON.stringify(data) }),
  updateLedgerEntry:  (id, entryId, data) => request(`/groups/${id}/ledger/${entryId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLedgerEntry:  (id, entryId)       => request(`/groups/${id}/ledger/${entryId}`, { method: 'DELETE' }),
};

// ─── Finance ──────────────────────────────────────────────────────────────

export const finance = {
  listAccounts:     ()         => request('/finance/accounts'),
  createAccount:    (data)     => request('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount:    (id, data) => request(`/finance/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  configureAccount: (id, data) => request(`/finance/accounts/${id}/config`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount:    (id)       => request(`/finance/accounts/${id}`, { method: 'DELETE' }),
  getGroupBfSetting:  ()       => request('/finance/group-bf-setting'),
  setGroupBfSetting:  (enabled) => request('/finance/group-bf-setting', { method: 'PATCH', body: JSON.stringify({ groupBfEnabled: enabled }) }),
  getPaymentMethodDefaults: () => request('/finance/payment-method-defaults'),
  setPaymentMethodDefaults: (data) => request('/finance/payment-method-defaults', { method: 'PUT', body: JSON.stringify(data) }),

  listCategories:   ()         => request('/finance/categories'),
  createCategory:   (data)     => request('/finance/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory:   (id, data) => request(`/finance/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory:   (id)       => request(`/finance/categories/${id}`, { method: 'DELETE' }),

  listTransactions: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.accountId)  qs.set('accountId',  params.accountId);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.groupId)    qs.set('groupId',    params.groupId);
    if (params.memberId)   qs.set('memberId',   params.memberId);
    if (params.year)       qs.set('year',       String(params.year));
    const query = qs.toString();
    return request(`/finance/transactions${query ? '?' + query : ''}`);
  },
  getTransaction:    (id)       => request(`/finance/transactions/${id}`),
  createTransaction: (data)     => request('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/finance/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTransaction: (id)       => request(`/finance/transactions/${id}`, { method: 'DELETE' }),
  refundTransaction: (id, data) => request(`/finance/transactions/${id}/refund`, { method: 'POST', body: JSON.stringify(data) }),
  bulkPending:       (ids, pending) => request('/finance/transactions/bulk-pending', { method: 'PATCH', body: JSON.stringify({ ids, pending }) }),

  // Transfers
  listTransfers:   ()              => request('/finance/transfers'),
  getTransfer:     (id)            => request(`/finance/transfers/${id}`),
  createTransfer:  (data)          => request('/finance/transfers', { method: 'POST', body: JSON.stringify(data) }),
  updateTransfer:  (id, data)      => request(`/finance/transfers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTransfer:  (id)            => request(`/finance/transfers/${id}`, { method: 'DELETE' }),

  // Reconcile
  getReconcileData: (accountId)    => request(`/finance/reconcile?accountId=${encodeURIComponent(accountId)}`),
  reconcile:        (data)         => request('/finance/reconcile', { method: 'POST', body: JSON.stringify(data) }),

  // Credit Batches
  listBatches: (params = {}) => {
    const qs = new URLSearchParams();
    qs.set('accountId', params.accountId);
    if (params.mode) qs.set('mode', params.mode);
    if (params.date) qs.set('date', params.date);
    return request(`/finance/batches?${qs.toString()}`);
  },
  getBatch:         (id)       => request(`/finance/batches/${id}`),
  getUnbatched:     (accountId) => request(`/finance/batches/unbatched?accountId=${encodeURIComponent(accountId)}`),
  createBatch:      (data)     => request('/finance/batches', { method: 'POST', body: JSON.stringify(data) }),
  addToBatch:       (id, transactionIds) =>
    request(`/finance/batches/${id}/transactions`, { method: 'POST', body: JSON.stringify({ transactionIds }) }),
  removeFromBatch:  (id, transactionIds) =>
    request(`/finance/batches/${id}/transactions`, { method: 'DELETE', body: JSON.stringify({ transactionIds }) }),
  updateBatch:      (id, data) => request(`/finance/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBatch:      (id)       => request(`/finance/batches/${id}`, { method: 'DELETE' }),

  // Financial Statement
  // accountId can be 'all' or an array of IDs (sent as comma-separated)
  getStatement: (accountId, year) => {
    const qs = new URLSearchParams();
    qs.set('accountId', Array.isArray(accountId) ? accountId.join(',') : accountId);
    if (year) qs.set('year', String(year));
    return request(`/finance/statement?${qs.toString()}`);
  },

  // Groups Statement
  getGroupsStatement: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)             qs.set('from', params.from);
    if (params.to)               qs.set('to',   params.to);
    if (params.showTransactions) qs.set('showTransactions', '1');
    return request(`/finance/groups-statement?${qs.toString()}`);
  },
};

// ─── Gift Aid ─────────────────────────────────────────────────────────────

export const giftAid = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.year)           qs.set('year', String(params.year));
    if (params.excludeClaimed !== undefined) qs.set('excludeClaimed', params.excludeClaimed ? '1' : '0');
    const q = qs.toString();
    return request(`/gift-aid${q ? '?' + q : ''}`);
  },
  download: (ids, from, to) =>
    requestBlob('/gift-aid/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, from, to }),
    }),
  mark: (ids, ids_2) =>
    request('/gift-aid/mark', { method: 'POST', body: JSON.stringify({ ids, ids_2 }) }),
  log: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)     qs.set('from', params.from);
    if (params.to)       qs.set('to', params.to);
    if (params.memberId) qs.set('memberId', params.memberId);
    const q = qs.toString();
    return request(`/gift-aid/log${q ? '?' + q : ''}`);
  },
};

// ─── Polls ────────────────────────────────────────────────────────────────

export const polls = {
  list:         ()                 => request('/polls'),
  create:       (data)             => request('/polls', { method: 'POST', body: JSON.stringify(data) }),
  update:       (id, data)         => request(`/polls/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:       (id)               => request(`/polls/${id}`, { method: 'DELETE' }),
  clearAll:     (id)               => request(`/polls/${id}/clear`, { method: 'POST' }),
  addMembers:   (id, memberIds)    => request(`/polls/${id}/members`, { method: 'POST', body: JSON.stringify({ memberIds }) }),
  setForMember: (memberId, pollIds) => request(`/polls/by-member/${memberId}`, { method: 'PUT', body: JSON.stringify({ pollIds }) }),
};

// ─── Settings ─────────────────────────────────────────────────────────────

export const settings = {
  get:           ()     => request('/settings'),
  update:        (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  getYearConfig:          () => request('/settings/year-config'),
  getNewMemberDefaults:   () => request('/settings/new-member-defaults'),
  getCustomFieldLabels:   () => request('/settings/custom-field-labels'),
  getSiteworksConfig:     () => request('/settings/siteworks-config'),
  getHomeInfo:            () => request('/settings/home-info'),
};

// ─── Custom Fields ────────────────────────────────────────────────────────

export const customFields = {
  get:    ()     => request('/custom-fields'),
  update: (data) => request('/custom-fields', { method: 'PATCH', body: JSON.stringify(data) }),
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

  restoreBackup: (token, tenantSlug, file) => {
    const form = new FormData();
    form.append('backup', file);
    return fetch(`${BASE}/system/restore/${tenantSlug}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }));
  },

  deleteTenant: (token, id) =>
    fetch(`${BASE}/system/tenants/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),

  setTempPassword: (token, id, password) =>
    fetch(`${BASE}/system/tenants/${id}/set-temp-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),

  getSettings: (token) =>
    fetch(`${BASE}/system/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),

  updateSettings: (token, data) =>
    fetch(`${BASE}/system/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }).then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; })),
};

// ─── Audit log ────────────────────────────────────────────────────────────

export const audit = {
  list:         ({ from, to } = {}) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to)   qs.set('to',   to);
    const q = qs.toString();
    return request(`/audit${q ? '?' + q : ''}`);
  },
  get:          (id)     => request(`/audit/${encodeURIComponent(id)}`),
  deleteBefore: (before) => request('/audit', { method: 'DELETE', body: JSON.stringify({ before }) }),
};

// ─── Offices ──────────────────────────────────────────────────────────────

export const offices = {
  list:        ()         => request('/offices'),
  listMembers: ()         => request('/offices/members'),
  create:      (data)     => request('/offices', { method: 'POST', body: JSON.stringify(data) }),
  update:      (id, data) => request(`/offices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:      (id)       => request(`/offices/${id}`, { method: 'DELETE' }),
};

// ─── Backup ────────────────────────────────────────────────────────────────

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
async function requestMultipart(path, formData) {
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

export const backup = {
  export: (type) => requestBlob(`/backup/export?type=${type}`),
};

// ─── Email ─────────────────────────────────────────────────────────────────

// ─── System Messages ──────────────────────────────────────────────────────

export const systemMessages = {
  list:   ()         => request('/system-messages'),
  update: (id, data) => request(`/system-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Calendar ─────────────────────────────────────────────────────────────

export const calendar = {
  listEvents: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)     qs.set('from',     params.from);
    if (params.to)       qs.set('to',       params.to);
    if (params.memberId) qs.set('memberId', params.memberId);
    if (params.venueId)  qs.set('venueId',  params.venueId);
    if (params.groupId)  qs.set('groupId',  params.groupId);
    const q = qs.toString();
    return request(`/calendar/events${q ? '?' + q : ''}`);
  },
  downloadPdf: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)     qs.set('from',     params.from);
    if (params.to)       qs.set('to',       params.to);
    if (params.memberId) qs.set('memberId', params.memberId);
    if (params.venueId)  qs.set('venueId',  params.venueId);
    if (params.groupId)  qs.set('groupId',  params.groupId);
    const q = qs.toString();
    return requestBlob(`/calendar/events/pdf${q ? '?' + q : ''}`);
  },
  searchMembers: (q) => request(`/calendar/members/search?q=${encodeURIComponent(q)}`),

  // Open meetings
  listOpenEvents:  ()             => request('/calendar/open-events'),
  createOpenEvents:(data)         => request('/calendar/open-events', { method: 'POST', body: JSON.stringify(data) }),
  updateOpenEvent: (id, data)     => request(`/calendar/open-events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOpenEvents:(ids)          => request('/calendar/open-events', { method: 'DELETE', body: JSON.stringify({ ids }) }),
};

// ─── Membership Cards ────────────────────────────────────────────────────

export const membershipCards = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.show)   qs.set('show',   params.show);
    if (params.pollId) qs.set('pollId', params.pollId);
    const q = qs.toString();
    return request(`/membership-cards${q ? '?' + q : ''}`);
  },
  downloadCards: (ids, advanceYear) => {
    const qs = new URLSearchParams({ ids: ids.join(','), advanceYear: advanceYear ? '1' : '0' });
    return requestBlob(`/membership-cards/download?${qs}`);
  },
  downloadBlank: (advanceYear) => {
    const qs = new URLSearchParams({ advanceYear: advanceYear ? '1' : '0' });
    return requestBlob(`/membership-cards/blank?${qs}`);
  },
  downloadExcel: (ids, advanceYear) => {
    const qs = new URLSearchParams({ ids: ids.join(','), advanceYear: advanceYear ? '1' : '0' });
    return requestBlob(`/membership-cards/excel?${qs}`);
  },
  markPrinted: (memberIds) =>
    request('/membership-cards/mark-printed', { method: 'POST', body: JSON.stringify({ memberIds }) }),
};

// ─── Public Links ─────────────────────────────────────────────────────────

export const publicLinks = {
  get:    () => request('/public-links'),
  update: (data) => request('/public-links', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Public (unauthenticated) ─────────────────────────────────────────────
// These use direct fetch (no auth token) since they're public pages.

export const publicApi = {
  getJoinConfig: (slug) =>
    fetch(`${BASE}/public/${slug}/join-config`).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  submitJoin: (slug, data) =>
    fetch(`${BASE}/public/${slug}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  confirmPayment: (slug, data) =>
    fetch(`${BASE}/public/${slug}/payment-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  resumePayment: (slug, token) =>
    fetch(`${BASE}/public/${slug}/resume-payment/${token}`).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  emailPaymentLink: (slug, paymentToken) =>
    fetch(`${BASE}/public/${slug}/email-payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentToken }),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  portalRegister: (slug, data) =>
    fetch(`${BASE}/public/${slug}/portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  portalVerifyEmail: (slug, token) =>
    fetch(`${BASE}/public/${slug}/portal/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  portalLogin: (slug, email, password) =>
    fetch(`${BASE}/public/${slug}/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  portalForgotPassword: (slug, email) =>
    fetch(`${BASE}/public/${slug}/portal/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  portalResetPassword: (slug, token, password) =>
    fetch(`${BASE}/public/${slug}/portal/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  // Public information pages (unauthenticated)
  getPublicGroups: (slug) =>
    fetch(`${BASE}/public/${slug}/groups`).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    ),
  getPublicCalendar: (slug, params = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to)   qs.set('to', params.to);
    const q = qs.toString();
    return fetch(`${BASE}/public/${slug}/calendar${q ? '?' + q : ''}`).then((r) =>
      r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
    );
  },
};

// ─── Portal (authenticated member) ───────────────────────────────────────────
// These use the portal JWT from sessionStorage.

function portalRequest(slug, path, options = {}) {
  const token = sessionStorage.getItem('portalToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  return fetch(`${BASE}/public/${slug}/portal/app${path}`, { ...options, headers })
    .then((r) => r.json().then((b) => {
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      return b;
    }));
}

function portalBlobRequest(slug, path) {
  const token = sessionStorage.getItem('portalToken');
  const headers = { ...(token && { Authorization: `Bearer ${token}` }) };
  return fetch(`${BASE}/public/${slug}/portal/app${path}`, { headers })
    .then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      let filename = 'download.pdf';
      const cd = r.headers.get('Content-Disposition');
      if (cd) { const m = cd.match(/filename="([^"]+)"/); if (m) filename = m[1]; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    });
}

export const portalApi = {
  getHome: (slug) => portalRequest(slug, '/home'),

  // Groups (10.2.2)
  getGroups: (slug) => portalRequest(slug, '/groups'),
  joinGroup: (slug, groupId) => portalRequest(slug, `/groups/${groupId}/join`, { method: 'POST' }),
  leaveGroup: (slug, groupId) => portalRequest(slug, `/groups/${groupId}/leave`, { method: 'POST' }),

  // Calendar (10.2.3)
  getCalendar: (slug, params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)   qs.set('from', params.from);
    if (params.to)     qs.set('to', params.to);
    if (params.filter) qs.set('filter', params.filter);
    if (params.groupId) qs.set('groupId', params.groupId);
    const q = qs.toString();
    return portalRequest(slug, `/calendar${q ? '?' + q : ''}`);
  },
  downloadCalendarPdf: (slug, params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)   qs.set('from', params.from);
    if (params.to)     qs.set('to', params.to);
    if (params.filter) qs.set('filter', params.filter);
    if (params.groupId) qs.set('groupId', params.groupId);
    const q = qs.toString();
    return portalBlobRequest(slug, `/calendar/pdf${q ? '?' + q : ''}`);
  },

  // Personal Details (10.2.4)
  getPersonalDetails: (slug) => portalRequest(slug, '/personal-details'),
  updatePersonalDetails: (slug, data) => portalRequest(slug, '/personal-details', {
    method: 'PATCH', body: JSON.stringify(data),
  }),
  changePassword: (slug, data) => portalRequest(slug, '/change-password', {
    method: 'POST', body: JSON.stringify(data),
  }),

  // Photo (10.2.4)
  uploadPhoto: (slug, data, mimeType) => portalRequest(slug, '/photo', {
    method: 'POST', body: JSON.stringify({ data, mimeType }),
  }),
  deletePhoto: (slug) => portalRequest(slug, '/photo', { method: 'DELETE' }),
  getPhotoBlob: (slug) => {
    const token = sessionStorage.getItem('portalToken');
    const headers = { ...(token && { Authorization: `Bearer ${token}` }) };
    return fetch(`${BASE}/public/${slug}/portal/app/photo`, { headers })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.blob();
      });
  },

  // Replacement Card (10.2.5)
  requestCard: (slug) => portalRequest(slug, '/request-card', { method: 'POST' }),
};

export const email = {
  getFromAddresses: () => request('/email/from-addresses'),

  listStandardMessages: () => request('/email/standard-messages'),
  saveStandardMessage:  (data) => request('/email/standard-messages', { method: 'POST', body: JSON.stringify(data) }),
  deleteStandardMessage:(id)   => request(`/email/standard-messages/${id}`, { method: 'DELETE' }),

  /** Send email. data = { memberIds, subject, body, fromEmail, replyTo, copyToSelf }; attachments = File[] */
  send: (data, attachments = []) => {
    if (attachments.length === 0) {
      // Send as JSON if no attachments
      return request('/email/send', { method: 'POST', body: JSON.stringify(data) });
    }
    // Multipart when attachments present
    const form = new FormData();
    form.append('data', JSON.stringify(data));
    for (const f of attachments) form.append('attachments', f);
    const headers = {
      ...(typeof window !== 'undefined' && {}), // no Content-Type — browser sets with boundary
    };
    return requestMultipart('/email/send', form);
  },

  listDelivery: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to)   qs.set('to',   params.to);
    const q = qs.toString();
    return request(`/email/delivery${q ? '?' + q : ''}`);
  },
  getDelivery:        (batchId)  => request(`/email/delivery/${batchId}`),
  refreshDelivery:    (batchId)  => request(`/email/delivery/${batchId}/refresh`, { method: 'POST' }),

  unblock: (emailAddr) => request('/email/unblocker', { method: 'POST', body: JSON.stringify({ email: emailAddr }) }),
};

export const letters = {
  listStandardLetters: () => request('/letters/standard-letters'),
  saveStandardLetter:  (data) => request('/letters/standard-letters', { method: 'POST', body: JSON.stringify(data) }),
  deleteStandardLetter:(id)   => request(`/letters/standard-letters/${id}`, { method: 'DELETE' }),

  /** Download letter PDF. data = { memberIds, body (TipTap JSON) } */
  download: (data) => requestBlob('/letters/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
};
