// beacon2/frontend/src/pages/public/JoinPending.jsx
// Shown after a joining application is submitted but BEFORE payment.
// Displays the applicant's details and offers:
//   - "Pay now" button → redirects to PayPal (or stub)
//   - "Email me this link" → sends a resume-payment link to their email
//   - Bookmarkable resume-payment URL

import { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';

export default function JoinPending() {
  const { slug } = useParams();
  const location = useLocation();
  const data = location.state; // passed from JoinForm via navigate()

  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // If user navigated here without state (e.g. typed URL), show fallback
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-700 mb-2">Application Not Found</h1>
          <p className="text-sm text-slate-600 mb-4">
            If you have a payment link, please use that to continue.
            Otherwise, you can start a new application.
          </p>
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

  const {
    membershipNumber, redirectUrl, paymentToken,
    amount, className, forenames, surname,
  } = data;

  const resumeUrl = `${window.location.origin}/public/${slug}/resume-payment/${paymentToken}`;

  function handlePayNow() {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

  async function handleEmailLink() {
    setEmailSending(true);
    setEmailError('');
    try {
      await publicApi.emailPaymentLink(slug, paymentToken);
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-xl font-bold text-center text-green-700 mb-2">
            Application Submitted
          </h1>
          <p className="text-sm text-slate-600 text-center mb-6">
            Thank you, {forenames}. Your application has been received.
          </p>

          {/* Application summary */}
          <div className="bg-slate-50 rounded-md p-4 mb-6 text-sm space-y-1">
            <p><span className="font-medium text-slate-700">Name:</span> {forenames} {surname}</p>
            <p><span className="font-medium text-slate-700">Membership number:</span> {membershipNumber}</p>
            <p><span className="font-medium text-slate-700">Membership type:</span> {className}</p>
            {amount > 0 && (
              <p><span className="font-medium text-slate-700">Amount due:</span> &pound;{Number(amount).toFixed(2)}</p>
            )}
          </div>

          {/* Payment required message */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-1">Payment required</p>
            <p className="text-sm text-amber-700">
              Your membership will be activated once payment is received.
              You can pay now or use the link below to pay later.
            </p>
          </div>

          {/* Pay now button */}
          <button
            type="button"
            onClick={handlePayNow}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-3 text-sm font-medium transition-colors mb-4"
          >
            Pay Now{amount > 0 ? ` — \u00A3${Number(amount).toFixed(2)}` : ''}
          </button>

          {/* Pay later section */}
          <div className="border-t border-slate-200 pt-4 mt-2">
            <p className="text-sm font-medium text-slate-700 mb-2">Pay later</p>
            <p className="text-xs text-slate-500 mb-3">
              Bookmark this link or email it to yourself to complete payment later:
            </p>

            {/* Copyable link */}
            <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 mb-3">
              <p className="text-xs text-blue-700 break-all select-all">{resumeUrl}</p>
            </div>

            {/* Email link button */}
            {!emailSent ? (
              <button
                type="button"
                onClick={handleEmailLink}
                disabled={emailSending}
                className="w-full border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:text-blue-300 rounded px-4 py-2 text-sm transition-colors"
              >
                {emailSending ? 'Sending...' : 'Email me this link'}
              </button>
            ) : (
              <p className="text-sm text-green-700 font-medium text-center">
                Payment link sent to your email.
              </p>
            )}

            {emailError && (
              <p className="text-sm text-red-600 mt-2 text-center">{emailError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
