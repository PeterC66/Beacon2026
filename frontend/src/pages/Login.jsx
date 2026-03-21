// beacon2/frontend/src/pages/Login.jsx
// Tenant user sign-in.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
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

export default function Login() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ tenantSlug: getLastU3aCookie(), username: '', password: '' });
  const [showPw, setShowPw] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(form.tenantSlug, form.username, form.password);
    if (ok) {
      setLastU3aCookie(form.tenantSlug);
      navigate('/');
    }
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
            className="w-full border border-slate-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full border border-slate-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center">Passwords are case sensitive</p>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded font-medium text-sm transition-colors"
        >
          {loading ? 'Signing in…' : 'Enter'}
        </button>
      </form>

      <hr className="w-full max-w-xs mt-8 border-slate-400" />

      <p className="mt-4 text-sm text-slate-700">
        Forgotten your username or password?{' '}
        <a href="#forgot" className="text-blue-700 hover:underline">Click here.</a>
      </p>

      <p className="mt-6 text-sm text-slate-600 font-medium">v{__APP_VERSION__}</p>

    </div>
  );
}
