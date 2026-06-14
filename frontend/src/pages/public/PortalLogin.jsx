// beacon2/frontend/src/pages/public/PortalLogin.jsx
// Members Portal sign-in page (public, unauthenticated).

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { publicApi, setPortalToken } from '../../lib/api.js';
import PortalVersion from '../../components/PortalVersion.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import PublicContact from '../../components/PublicContact.jsx';
import { inputCls, labelCls } from '../../components/ui/Input.jsx';
import { SS_PORTAL_MEMBER, SS_PORTAL_SLUG } from '../../lib/storageKeys.js';

export default function PortalLogin() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    publicApi
      .getPublicInfo(slug)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await publicApi.portalLogin(slug, email.trim(), password);
      setPortalToken(result.token);
      sessionStorage.setItem(SS_PORTAL_MEMBER, JSON.stringify(result.member));
      sessionStorage.setItem(SS_PORTAL_SLUG, slug);
      navigate(`/public/${slug}/portal/home`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <PortalVersion />
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-center mb-1">Members Portal</h1>
        <p className="text-sm text-slate-600 text-center mb-6">Sign in to access your membership</p>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="portal-login-email" className={labelCls}>
              Email address
            </label>
            <input
              id="portal-login-email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} w-full`}
              autoComplete="email"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="portal-login-password" className={labelCls}>
              Password
            </label>
            <PasswordInput
              id="portal-login-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} w-full`}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-3 text-sm font-medium transition-colors mb-4"
          >
            {submitting ? 'Signing in...' : 'Confirm Identity'}
          </button>
        </form>

        <div className="text-center space-y-2 text-sm">
          <Link
            to={`/public/${slug}/portal/register`}
            className="block text-blue-700 hover:underline"
          >
            Register for a membership account
          </Link>
          <Link
            to={`/public/${slug}/portal/forgot-password`}
            className="block text-blue-700 hover:underline"
          >
            Forgotten Password
          </Link>
          <Link to={`/public/${slug}/join`} className="block text-blue-700 hover:underline">
            Not a member? Join online
          </Link>
        </div>

        {info && (
          <PublicContact
            phone={info.publicPhone}
            email={info.publicEmail}
            homePage={info.homePage}
            className="mt-6 pt-4 border-t border-slate-200"
          />
        )}
      </div>
    </div>
  );
}
