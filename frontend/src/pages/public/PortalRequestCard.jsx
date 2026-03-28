// beacon2/frontend/src/pages/public/PortalRequestCard.jsx
// Members Portal — request replacement membership card by email (doc 10.2.5).

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { portalApi } from '../../lib/api.js';

export default function PortalRequestCard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleRequest() {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await portalApi.requestCard(slug);
      setMessage(result.message);
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('401')) {
        navigate(`/public/${slug}/portal`, { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <div className="mb-4">
          <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
            &larr; Members Portal
          </Link>
        </div>

        <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
          E-Mail Replacement Membership Card
        </h1>

        {message && (
          <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        {!message && (
          <>
            <p className="text-sm text-slate-600 text-center mb-6">
              Click the button below to receive a replacement membership card
              by email as a PDF attachment.
            </p>
            <p className="text-xs text-slate-500 text-center mb-6">
              Your membership must be current and within the standard renewal period.
            </p>
            <div className="text-center">
              <button
                onClick={handleRequest}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium"
              >
                {submitting ? 'Requesting...' : 'E-Mail Replacement Membership Card'}
              </button>
            </div>
          </>
        )}

        {message && (
          <div className="text-center mt-4">
            <Link
              to={`/public/${slug}/portal/home`}
              className="text-sm text-blue-700 hover:underline"
            >
              Return to Members Portal
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
