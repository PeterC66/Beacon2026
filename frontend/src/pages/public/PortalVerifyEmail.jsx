// beacon2/frontend/src/pages/public/PortalVerifyEmail.jsx
// Email verification landing page.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';

export default function PortalVerifyEmail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    publicApi.portalVerifyEmail(slug, token)
      .then((r) => { setStatus('success'); setMessage(r.message); })
      .catch((e) => { setStatus('error'); setMessage(e.message); });
  }, [slug, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <h1 className="text-xl font-bold mb-2">Verifying your email...</h1>
            <p className="text-sm text-slate-600">Please wait.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-green-700 mb-2">Email Verified</h1>
            <p className="text-sm text-slate-600 mb-4">{message}</p>
            <Link to={`/public/${slug}/portal`}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
              Sign in
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-red-700 mb-2">Verification Failed</h1>
            <p className="text-sm text-slate-600 mb-4">{message}</p>
            <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline text-sm">
              Return to sign-in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
