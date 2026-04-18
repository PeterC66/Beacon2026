// beacon2/frontend/src/pages/public/PortalLogin.jsx
// Members Portal sign-in page (public, unauthenticated).

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { publicApi, setPortalToken } from '../../lib/api.js';
import PortalVersion from '../../components/PortalVersion.jsx';

export default function PortalLogin() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      sessionStorage.setItem('portalMember', JSON.stringify(result.member));
      sessionStorage.setItem('portalSlug', slug);
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <Link to={`/public/${slug}/portal/register`} className="block text-blue-700 hover:underline">
            Register for a membership account
          </Link>
          <Link to={`/public/${slug}/portal/forgot-password`} className="block text-blue-700 hover:underline">
            Forgotten Password
          </Link>
          <Link to={`/public/${slug}/join`} className="block text-blue-700 hover:underline">
            Not a member? Join online
          </Link>
        </div>
      </div>
    </div>
  );
}
