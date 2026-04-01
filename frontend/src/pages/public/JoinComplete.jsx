// beacon2/frontend/src/pages/public/JoinComplete.jsx
// Displayed after returning from PayPal (or stub).
// Confirms payment with the backend and shows the result.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';
import PortalVersion from '../../components/PortalVersion.jsx';

export default function JoinComplete() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('confirming'); // confirming | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const paymentId = searchParams.get('paymentId');
    const joinData = sessionStorage.getItem('joinResult');
    let memberId = null;

    if (joinData) {
      try {
        const parsed = JSON.parse(joinData);
        memberId = parsed.memberId;
      } catch {}
      sessionStorage.removeItem('joinResult');
    }

    if (!paymentId || !memberId) {
      setStatus('error');
      setError('Missing payment information. Please try joining again.');
      return;
    }

    publicApi.confirmPayment(slug, { paymentId, memberId })
      .then((r) => {
        setResult(r);
        setStatus('success');
      })
      .catch((e) => {
        setError(e.message);
        setStatus('error');
      });
  }, [slug, searchParams]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <PortalVersion />
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        {status === 'confirming' && (
          <>
            <h1 className="text-xl font-bold mb-2">Confirming your payment...</h1>
            <p className="text-sm text-slate-600">Please wait while we process your membership.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-green-700 mb-2">Welcome!</h1>
            <p className="text-sm text-slate-600 mb-4">
              Your membership application has been confirmed.
            </p>
            {result?.membershipNumber && (
              <p className="text-lg font-bold mb-4">
                Your membership number is: {result.membershipNumber}
              </p>
            )}
            <p className="text-sm text-slate-600 mb-6">
              You will receive a confirmation email shortly.
            </p>
            <Link
              to={`/public/${slug}/portal`}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
            >
              Register for the Members Portal
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <Link
              to={`/public/${slug}/join`}
              className="text-blue-700 hover:underline text-sm"
            >
              Try again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
