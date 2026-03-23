// beacon2/frontend/src/pages/public/PortalForgotPassword.jsx

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';

export default function PortalForgotPassword() {
  const { slug } = useParams();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await publicApi.portalForgotPassword(slug, email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2">Check your email</h1>
          <p className="text-sm text-slate-600 mb-4">
            If an account exists with that email address, we have sent a password reset link.
          </p>
          <p className="text-xs text-slate-500 mb-4">If nothing arrives, check your Spam folder.</p>
          <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline text-sm">
            Return to sign-in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-center mb-1">Reset Password</h1>
        <p className="text-sm text-slate-600 text-center mb-6">Enter your email address to receive a reset link.</p>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoComplete="email" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-3 text-sm font-medium transition-colors mb-4">
            {submitting ? 'Sending...' : 'Reset Password'}
          </button>
        </form>
        <div className="text-center text-sm">
          <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline">Back to sign-in</Link>
        </div>
      </div>
    </div>
  );
}
