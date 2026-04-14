// api/public.js — Public (unauthenticated) API.
// Uses raw fetch() with no auth token since these are public pages.

import { BASE } from './core.js';

function publicFetch(url, options = {}) {
  return fetch(url, options).then((r) =>
    r.json().then((b) => { if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`); return b; }),
  );
}

export const publicApi = {
  getJoinConfig: (slug) =>
    publicFetch(`${BASE}/public/${slug}/join-config`),

  submitJoin: (slug, data) =>
    publicFetch(`${BASE}/public/${slug}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  confirmPayment: (slug, data) =>
    publicFetch(`${BASE}/public/${slug}/payment-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  resumePayment: (slug, token) =>
    publicFetch(`${BASE}/public/${slug}/resume-payment/${token}`),

  emailPaymentLink: (slug, paymentToken) =>
    publicFetch(`${BASE}/public/${slug}/email-payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentToken }),
    }),

  portalRegister: (slug, data) =>
    publicFetch(`${BASE}/public/${slug}/portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  portalVerifyEmail: (slug, token) =>
    publicFetch(`${BASE}/public/${slug}/portal/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),

  portalLogin: (slug, email, password) =>
    publicFetch(`${BASE}/public/${slug}/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  portalForgotPassword: (slug, email) =>
    publicFetch(`${BASE}/public/${slug}/portal/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),

  portalResetPassword: (slug, token, password) =>
    publicFetch(`${BASE}/public/${slug}/portal/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }),

  // Public information pages (unauthenticated)
  getPublicGroups: (slug) =>
    publicFetch(`${BASE}/public/${slug}/groups`),

  getPublicCalendar: (slug, params = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to)   qs.set('to', params.to);
    const q = qs.toString();
    return publicFetch(`${BASE}/public/${slug}/calendar${q ? '?' + q : ''}`);
  },
};
