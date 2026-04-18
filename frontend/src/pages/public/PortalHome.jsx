// beacon2/frontend/src/pages/public/PortalHome.jsx
// Members Portal dashboard (doc 10.2) — shows available features based on portal_config.

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { portalApi, hasPortalToken, clearPortalToken } from '../../lib/api.js';
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

export default function PortalHome() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPortalToken()) {
      navigate(`/public/${slug}/portal`, { replace: true });
      return;
    }
    portalApi.getHome(slug)
      .then(setData)
      .catch((err) => {
        if (err.message.includes('expired') || err.message.includes('401')) {
          clearPortalToken();
          sessionStorage.removeItem('portalMember');
          navigate(`/public/${slug}/portal`, { replace: true });
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  function handleLogout() {
    clearPortalToken();
    sessionStorage.removeItem('portalMember');
    sessionStorage.removeItem('portalSlug');
    navigate(`/public/${slug}/portal`);
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
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline">
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  const { u3aName, portalConfig, member } = data;
  const greeting = getGreeting();
  const renewalText = member.nextRenewal
    ? `Your membership continues until ${fmtDate(member.nextRenewal)}`
    : null;

  const options = [
    portalConfig.renewals && {
      label: 'Renew your membership',
      to: `/public/${slug}/portal/renewal`,
    },
    portalConfig.groups && {
      label: `${u3aName} u3a groups`,
      to: `/public/${slug}/portal/groups`,
    },
    portalConfig.calendar && {
      label: 'Calendar of meetings and events',
      to: `/public/${slug}/portal/calendar`,
    },
    portalConfig.personalDetails && {
      label: 'Update your personal details',
      to: `/public/${slug}/portal/personal-details`,
    },
    portalConfig.replacementCard && {
      label: 'E-Mail replacement Membership Card',
      to: `/public/${slug}/portal/request-card`,
    },
  ].filter(Boolean);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <PortalVersion />
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <p className="text-lg font-semibold text-slate-800">
            {greeting}, {member.displayName}
          </p>
          {renewalText && (
            <p className="text-sm text-slate-600 mt-1">{renewalText}</p>
          )}
        </div>

        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Select an option
        </h2>

        <div className="space-y-2">
          {options.map((opt) => (
            <Link
              key={opt.to}
              to={opt.to}
              className="block w-full text-left px-4 py-3 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium text-sm transition-colors"
            >
              {opt.label}
            </Link>
          ))}
        </div>

        {options.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            No portal features are currently enabled for this organisation.
          </p>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-blue-700 hover:underline"
          >
            Logout and return to {u3aName} website
          </button>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
