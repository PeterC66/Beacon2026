// beacon2/frontend/src/pages/Login.jsx
// Tenant user sign-in with inline password recovery (doc 9.6).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { auth as authApi } from '../lib/api.js';
import BeaconLogo from '../components/BeaconLogo.jsx';

const COOKIE_NAME = 'beacon_last_u3a';
const COOKIE_DAYS = 365;

function getLastU3aCookie() {
  const match = document.cookie.split('; ').find((c) => c.startsWith(COOKIE_NAME + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

function setLastU3aCookie(slug) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(slug)}; expires=${expires}; path=/; SameSite=Lax`;
}

const inputCls = 'w-full border border-slate-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// ── Recovery section (doc 9.6) — rendered outside Login to avoid nested component ──

function renderRecoverySection(tenantSlug, recoverState, setRecoverState) {
  const { open, form, step, securityQuestion, userId, busy, error, success } = recoverState;

  const setField = (field, value) =>
    setRecoverState((s) => ({ ...s, form: { ...s.form, [field]: value } }));

  const handleIdentify = async (e) => {
    e.preventDefault();
    setRecoverState((s) => ({ ...s, busy: true, error: null, success: null }));
    try {
      const result = await authApi.recover(
        tenantSlug, form.forename, form.surname, form.postcode, form.email,
      );
      if (result.securityQuestion) {
        setRecoverState((s) => ({
          ...s, step: 'question', securityQuestion: result.securityQuestion,
          userId: result.userId, busy: false,
        }));
      } else {
        setRecoverState((s) => ({
          ...s, step: 'done', success: result.message, busy: false,
        }));
      }
    } catch (err) {
      setRecoverState((s) => ({ ...s, error: err.message, busy: false }));
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setRecoverState((s) => ({ ...s, busy: true, error: null }));
    try {
      const result = await authApi.recoverVerify(tenantSlug, userId, form.answer);
      setRecoverState((s) => ({
        ...s, step: 'done', success: result.message, busy: false,
      }));
    } catch (err) {
      setRecoverState((s) => ({ ...s, error: err.message, busy: false }));
    }
  };

  if (!open) return null;

  return (
    <div className="w-full max-w-xs mt-4 p-4 bg-slate-50 border border-slate-300 rounded-lg">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Recover your credentials</h2>
      <p className="text-xs text-slate-500 mb-3">
        Complete the following to recover your credentials. If you do not have
        an email address registered, please contact your system administrator.
      </p>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-300 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-green-50 border border-green-300 rounded text-green-700 text-xs">
          {success}
        </div>
      )}

      {step === 'identify' && (
        <form onSubmit={handleIdentify} className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Forename</label>
            <input value={form.forename} onChange={(e) => setField('forename', e.target.value)}
              required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Surname</label>
            <input value={form.surname} onChange={(e) => setField('surname', e.target.value)}
              required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Postcode</label>
            <input value={form.postcode} onChange={(e) => setField('postcode', e.target.value)}
              required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
              required className={inputCls} />
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-sm font-medium transition-colors">
            {busy ? 'Checking…' : 'Submit'}
          </button>
        </form>
      )}

      {step === 'question' && (
        <form onSubmit={handleVerify} className="space-y-2">
          <p className="text-xs text-slate-600 mb-2">
            Please answer your personal security question:
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">{securityQuestion}</label>
            <input value={form.answer} onChange={(e) => setField('answer', e.target.value)}
              required className={inputCls} />
            <p className="text-xs text-slate-500 mt-1">
              Type the answer in the same format as when it was originally set.
            </p>
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-sm font-medium transition-colors">
            {busy ? 'Verifying…' : 'Submit'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <p className="text-xs text-slate-600">
          You may now close this section and log in with your credentials.
        </p>
      )}
    </div>
  );
}

// ── Main Login component ─────────────────────────────────────────────────

export default function Login() {
  const { login, loading, error, mustChangePassword } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ tenantSlug: getLastU3aCookie(), username: '', password: '' });
  const [showPw, setShowPw] = useState(false);

  // Recovery state
  const [recoverState, setRecoverState] = useState({
    open: false,
    step: 'identify',  // 'identify' | 'question' | 'done'
    form: { forename: '', surname: '', postcode: '', email: '', answer: '' },
    securityQuestion: null,
    userId: null,
    busy: false,
    error: null,
    success: null,
  });

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(form.tenantSlug, form.username, form.password);
    if (ok) {
      setLastU3aCookie(form.tenantSlug);
      // Navigate happens on next render; mustChangePassword will redirect via ProtectedRoute
      navigate('/');
    }
  };

  const toggleRecover = (e) => {
    e.preventDefault();
    setRecoverState((s) => ({
      ...s,
      open: !s.open,
      // Reset state when closing
      ...(!s.open ? {} : {
        step: 'identify',
        form: { forename: '', surname: '', postcode: '', email: '', answer: '' },
        securityQuestion: null, userId: null, error: null, success: null,
      }),
    }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-10 pb-10">

      <BeaconLogo large />

      <h1 className="mt-6 text-xl font-bold text-center">Administration</h1>

      {error && (
        <div className="mt-4 w-full max-w-xs p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 w-full max-w-xs space-y-3">
        <div>
          <label htmlFor="tenantSlug" className="block text-sm font-medium text-slate-700 mb-1">u3a</label>
          <input
            id="tenantSlug"
            name="tenantSlug"
            value={form.tenantSlug}
            onChange={handleChange}
            placeholder="your-u3a-slug"
            required
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            required
            autoComplete="username"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              required
              className="w-full border border-slate-400 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
              title={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? '\u{1F648}' : '\u{1F441}'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center">Passwords are case sensitive</p>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded font-medium text-sm transition-colors"
        >
          {loading ? 'Signing in\u2026' : 'Enter'}
        </button>
      </form>

      <hr className="w-full max-w-xs mt-8 border-slate-400" />

      <p className="mt-4 text-sm text-slate-700">
        Forgotten your username or password?{' '}
        <button type="button" onClick={toggleRecover} className="text-blue-700 hover:underline">
          Click here.
        </button>
      </p>

      {renderRecoverySection(form.tenantSlug, recoverState, setRecoverState)}

      <p className="mt-6 text-sm text-slate-600 font-medium">v{__APP_VERSION__}</p>

    </div>
  );
}
