// beacon2/frontend/src/pages/public/PortalRenewal.jsx
// Members Portal — online membership renewal (doc 10.2.1).
// Shows renewal fee, Gift Aid options, and initiates PayPal payment.

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { portalApi } from '../../lib/api.js';
import PortalVersion from '../../components/PortalVersion.jsx';

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return '';
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function PortalRenewal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Gift Aid choices
  const [giftAid, setGiftAid] = useState(false);
  const [partnerGiftAid, setPartnerGiftAid] = useState(false);

  // Completion state (after payment confirmation)
  const [completed, setCompleted] = useState(false);
  const [completedData, setCompletedData] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem('portalToken');
    if (!token) {
      navigate(`/public/${slug}/portal`, { replace: true });
      return;
    }

    // Check if returning from PayPal with payment confirmation
    const paymentId = searchParams.get('paymentId');
    const status = searchParams.get('status');
    if (paymentId && status === 'success') {
      confirmPayment(paymentId);
      return;
    }

    loadRenewalInfo();
  }, [slug, navigate]);

  async function loadRenewalInfo() {
    try {
      const result = await portalApi.getRenewalInfo(slug);
      setInfo(result);
      // Pre-fill Gift Aid from existing declarations
      setGiftAid(!!result.member.giftAidFrom);
      if (result.partner) {
        setPartnerGiftAid(!!result.partner.giftAidFrom);
      }
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('401')) {
        sessionStorage.removeItem('portalToken');
        navigate(`/public/${slug}/portal`, { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment(paymentId) {
    try {
      const result = await portalApi.confirmRenewal(slug, { paymentId });
      setCompletedData(result);
      setCompleted(true);
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('401')) {
        sessionStorage.removeItem('portalToken');
        navigate(`/public/${slug}/portal`, { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRenew() {
    setSubmitting(true);
    setError('');
    try {
      const result = await portalApi.submitRenewal(slug, {
        giftAid,
        partnerGiftAid,
      });
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('401')) {
        sessionStorage.removeItem('portalToken');
        navigate(`/public/${slug}/portal`, { replace: true });
      } else {
        setError(err.message);
      }
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <PortalVersion />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  // ── Completion screen ──
  if (completed && completedData) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <PortalVersion />
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="mb-4">
            <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
              &larr; Members Portal
            </Link>
          </div>
          <h1 className="text-xl font-bold text-center text-green-700 mb-4">
            Renewal Complete
          </h1>
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
            <p className="text-sm text-green-800">
              Thank you! Your membership has been renewed successfully.
            </p>
          </div>
          <div className="bg-slate-50 rounded-md p-4 text-sm space-y-1">
            <p><span className="font-medium text-slate-700">Membership number:</span> {completedData.membershipNumber}</p>
            <p><span className="font-medium text-slate-700">Membership continues until:</span> {fmtDate(completedData.newNextRenewal)}</p>
          </div>
          <div className="text-center mt-6">
            <Link
              to={`/public/${slug}/portal/home`}
              className="text-sm text-blue-700 hover:underline"
            >
              Return to Members Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Error screen (no renewal info loaded) ──
  if (error && !info) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <PortalVersion />
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="mb-4">
            <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
              &larr; Members Portal
            </Link>
          </div>
          <h1 className="text-xl font-bold text-center text-slate-800 mb-4">
            Membership Renewal
          </h1>
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm text-center">
            {error}
          </div>
        </div>
      </div>
    );
  }

  const { member, partner, totalFee, showGiftAid, onlineRenewEmail } = info;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <PortalVersion />
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 max-w-lg w-full">
        <div className="mb-4">
          <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
            &larr; Members Portal
          </Link>
        </div>

        <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
          Membership Renewal
        </h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm text-center mb-4">
            {error}
          </div>
        )}

        {/* Renewal summary */}
        <div className="bg-slate-50 rounded-md p-4 mb-6 text-sm space-y-2">
          <p>
            <span className="font-medium text-slate-700">Member:</span>{' '}
            {member.forenames} {member.surname} (No. {member.membershipNumber})
          </p>
          <p>
            <span className="font-medium text-slate-700">Class:</span>{' '}
            {member.className}
          </p>
          <p>
            <span className="font-medium text-slate-700">Current renewal date:</span>{' '}
            {fmtDate(member.nextRenewal)}
          </p>
          <p>
            <span className="font-medium text-slate-700">Subscription:</span>{' '}
            &pound;{Number(member.fee).toFixed(2)}
          </p>

          {partner && (
            <>
              <hr className="border-slate-200 my-2" />
              <p>
                <span className="font-medium text-slate-700">Joint partner:</span>{' '}
                {partner.forenames} {partner.surname} (No. {partner.membershipNumber})
              </p>
              <p>
                <span className="font-medium text-slate-700">Partner subscription:</span>{' '}
                &pound;{Number(partner.fee).toFixed(2)}
              </p>
            </>
          )}

          <hr className="border-slate-200 my-2" />
          <p className="font-semibold text-slate-800">
            Total to pay: &pound;{Number(totalFee).toFixed(2)}
          </p>
        </div>

        {partner && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6 text-xs text-blue-800">
            Joint memberships must be renewed together. Both subscriptions are included in the total above.
          </div>
        )}

        {/* Gift Aid */}
        {showGiftAid && (
          <fieldset className="mb-6">
            <legend className="text-sm font-bold text-slate-700 mb-2">Gift Aid</legend>
            <p className="text-xs text-slate-500 mb-3">
              If you are a UK taxpayer, your u3a can claim Gift Aid on your subscription
              at no extra cost to you.
            </p>
            <label className="flex items-start gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={giftAid}
                onChange={(e) => setGiftAid(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I ({member.displayName}) would like Gift Aid claimed on my subscription
                {member.giftAidFrom && <span className="text-slate-400 ml-1">(currently opted in)</span>}
              </span>
            </label>
            {partner && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={partnerGiftAid}
                  onChange={(e) => setPartnerGiftAid(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I ({partner.displayName}) would like Gift Aid claimed on my subscription
                  {partner.giftAidFrom && <span className="text-slate-400 ml-1">(currently opted in)</span>}
                </span>
              </label>
            )}
          </fieldset>
        )}

        {onlineRenewEmail && (
          <p className="text-xs text-slate-500 mb-4">
            For enquiries about renewal, please contact{' '}
            <a href={`mailto:${onlineRenewEmail}`} className="text-blue-700 hover:underline">{onlineRenewEmail}</a>.
          </p>
        )}

        <button
          type="button"
          onClick={handleRenew}
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-3 text-sm font-medium transition-colors"
        >
          {submitting
            ? 'Processing...'
            : `Make Payment — \u00A3${Number(totalFee).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
