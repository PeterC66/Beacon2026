// beacon2/frontend/src/pages/public/ResumePayment.jsx
// Reached via the resume-payment link (from email or bookmark).
// Looks up the Applicant by payment token and offers to pay.

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';
import { isSafePaymentRedirect } from '../../lib/safeRedirect.js';
import PortalVersion from '../../components/PortalVersion.jsx';

export default function ResumePayment() {
  const { slug, token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicApi.resumePayment(slug, token)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug, token]);

  function handlePayNow() {
    if (!data?.redirectUrl) return;
    if (!isSafePaymentRedirect(data.redirectUrl)) {
      setError('The payment provider returned an unexpected redirect. Please contact your u3a.');
      return;
    }
    // Store result for the completion page (same as JoinForm flow)
    sessionStorage.setItem('joinResult', JSON.stringify({
      memberId: data.memberId,
    }));
    window.location.href = data.redirectUrl;
  }

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <PortalVersion />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <PortalVersion />
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-red-700 mb-2">Payment Link Issue</h1>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Link
            to={`/public/${slug}/join`}
            className="text-blue-700 hover:underline text-sm"
          >
            Start a new application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-8 px-4">
      <PortalVersion />
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-xl font-bold text-center mb-2">Complete Your Payment</h1>
          <p className="text-sm text-slate-600 text-center mb-6">
            Welcome back, {data.forenames}. Your application is waiting for payment.
          </p>

          {/* Application summary */}
          <div className="bg-slate-50 rounded-md p-4 mb-6 text-sm space-y-1">
            <p><span className="font-medium text-slate-700">Name:</span> {data.forenames} {data.surname}</p>
            <p><span className="font-medium text-slate-700">Membership number:</span> {data.membershipNumber}</p>
            {data.partner2 && (
              <>
                <p><span className="font-medium text-slate-700">Partner:</span> {data.partner2.forenames} {data.partner2.surname}</p>
                <p><span className="font-medium text-slate-700">Partner membership number:</span> {data.partner2.membershipNumber}</p>
              </>
            )}
            <p><span className="font-medium text-slate-700">Membership type:</span> {data.className}{data.partner2 ? ' (joint)' : ''}</p>
            {data.amount > 0 && (
              <p><span className="font-medium text-slate-700">Amount due:</span> &pound;{Number(data.amount).toFixed(2)}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handlePayNow}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-3 text-sm font-medium transition-colors"
          >
            Pay Now{data.amount > 0 ? ` — \u00A3${Number(data.amount).toFixed(2)}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
