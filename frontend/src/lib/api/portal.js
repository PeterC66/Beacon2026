// api/portal.js — Members Portal API (authenticated member via in-memory token).
// The portal JWT is held in a module-level variable — never in localStorage or
// sessionStorage — so that XSS cannot exfiltrate it. Page reload clears the
// session; members log in again.

import { BASE } from './core.js';

let portalToken = null;

export function setPortalToken(token) { portalToken = token; }
export function clearPortalToken()     { portalToken = null; }
export function getPortalToken()       { return portalToken; }
export function hasPortalToken()       { return !!portalToken; }

function portalRequest(slug, path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(portalToken && { Authorization: `Bearer ${portalToken}` }),
    ...options.headers,
  };
  return fetch(`${BASE}/public/${slug}/portal/app${path}`, { ...options, headers })
    .then((r) => r.json().then((b) => {
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      return b;
    }));
}

function portalBlobRequest(slug, path) {
  const headers = { ...(portalToken && { Authorization: `Bearer ${portalToken}` }) };
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
    if (params.from)        qs.set('from', params.from);
    if (params.to)          qs.set('to', params.to);
    if (params.filter)      qs.set('filter', params.filter);
    if (params.groupId)     qs.set('groupId', params.groupId);
    if (params.eventTypeId) qs.set('eventTypeId', params.eventTypeId);
    const q = qs.toString();
    return portalRequest(slug, `/calendar${q ? '?' + q : ''}`);
  },
  downloadCalendarPdf: (slug, params = {}) => {
    const qs = new URLSearchParams();
    if (params.from)        qs.set('from', params.from);
    if (params.to)          qs.set('to', params.to);
    if (params.filter)      qs.set('filter', params.filter);
    if (params.groupId)     qs.set('groupId', params.groupId);
    if (params.eventTypeId) qs.set('eventTypeId', params.eventTypeId);
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
    const headers = { ...(portalToken && { Authorization: `Bearer ${portalToken}` }) };
    return fetch(`${BASE}/public/${slug}/portal/app/photo`, { headers })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.blob();
      });
  },

  // Renewal (10.2.1)
  getRenewalInfo: (slug) => portalRequest(slug, '/renewal-info'),
  submitRenewal: (slug, data) => portalRequest(slug, '/renew', {
    method: 'POST', body: JSON.stringify(data),
  }),
  confirmRenewal: (slug, data) => portalRequest(slug, '/renewal-confirm', {
    method: 'POST', body: JSON.stringify(data),
  }),

  // Replacement Card (10.2.5)
  requestCard: (slug) => portalRequest(slug, '/request-card', { method: 'POST' }),
};
