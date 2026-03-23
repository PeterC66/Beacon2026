// beacon2/frontend/src/components/HelpWidget.jsx
// Zendesk Web Widget integration for context-sensitive help

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Map route path patterns to Zendesk help search terms.
 * The first matching pattern (by startsWith) wins.
 * More specific routes should appear before general ones.
 */
const ROUTE_HELP_TERMS = [
  // Login & auth
  { match: '/login',                   search: 'logging in password' },
  { match: '/change-password',         search: 'temporary password change' },

  // System admin
  { match: '/system/login',            search: 'system administration' },
  { match: '/system',                  search: 'system administration' },

  // Membership
  { match: '/membership/renewals',     search: 'membership renewals' },
  { match: '/membership/non-renewals', search: 'non renewals lapsed' },
  { match: '/membership/classes',      search: 'membership classes types' },
  { match: '/membership/statuses',     search: 'membership status' },
  { match: '/membership/cards',        search: 'membership cards' },

  // Members
  { match: '/members/new',            search: 'adding new member' },
  { match: '/members/recent',         search: 'recent members' },
  { match: '/members/statistics',     search: 'member statistics' },
  { match: '/members/',               search: 'member record' },
  { match: '/members',                search: 'members list search' },
  { match: '/addresses-export',       search: 'export addresses labels' },

  // Roles & users
  { match: '/roles',                  search: 'roles privileges' },
  { match: '/users',                  search: 'users accounts' },

  // Groups
  { match: '/groups/new',             search: 'creating new group' },
  { match: '/groups/',                search: 'group record' },
  { match: '/groups',                 search: 'groups interest' },
  { match: '/faculties',              search: 'faculties categories' },
  { match: '/venues/new',             search: 'venues' },
  { match: '/venues/',                search: 'venues' },
  { match: '/venues',                 search: 'venues' },
  { match: '/calendar',               search: 'calendar meetings' },

  // Finance
  { match: '/finance/accounts',       search: 'finance accounts' },
  { match: '/finance/payment-method', search: 'payment methods' },
  { match: '/finance/categories',     search: 'finance categories' },
  { match: '/finance/ledger',         search: 'ledger transactions' },
  { match: '/finance/transactions',   search: 'transactions payments' },
  { match: '/finance/transfers',      search: 'transfer money' },
  { match: '/finance/reconcile',      search: 'reconcile account' },
  { match: '/finance/statement',      search: 'financial statement' },
  { match: '/finance/groups-statement', search: 'groups financial statement' },
  { match: '/finance/gift-aid',       search: 'gift aid' },
  { match: '/finance/batches',        search: 'credit batches' },

  // Email
  { match: '/email/compose',          search: 'sending email' },
  { match: '/email/delivery',         search: 'email delivery' },
  { match: '/email/unblocker',        search: 'email bounced blocked' },

  // Admin & misc
  { match: '/admin/validate-members', search: 'validate members' },
  { match: '/polls',                  search: 'polls voting' },
  { match: '/custom-fields',          search: 'custom fields' },
  { match: '/audit',                  search: 'audit log' },
  { match: '/gift-aid-log',           search: 'gift aid log' },
  { match: '/officers',               search: 'officers committee' },
  { match: '/backup',                 search: 'backup data' },
  { match: '/preferences',            search: 'preferences settings' },
  { match: '/letters/compose',        search: 'letters mail merge' },

  // Settings
  { match: '/settings',               search: 'system settings' },
  { match: '/system-messages',        search: 'system messages' },
  { match: '/public-links',           search: 'public links joining' },

  // Public pages
  { match: '/public/',                search: 'online joining portal' },

  // Home / dashboard
  { match: '/',                        search: 'beacon getting started' },
];

function getSearchTerms(pathname) {
  const entry = ROUTE_HELP_TERMS.find((r) => {
    if (r.match === '/') return pathname === '/';
    return pathname.startsWith(r.match);
  });
  return entry?.search ?? 'beacon help';
}

const ZENDESK_KEY = import.meta.env.VITE_ZENDESK_KEY;

export default function HelpWidget() {
  const location = useLocation();
  const scriptLoaded = useRef(false);

  // Load the Zendesk Web Widget script once
  useEffect(() => {
    if (!ZENDESK_KEY || scriptLoaded.current) return;
    if (document.getElementById('ze-snippet')) {
      scriptLoaded.current = true;
      return;
    }

    const script = document.createElement('script');
    script.id = 'ze-snippet';
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${ZENDESK_KEY}`;
    script.async = true;

    script.onload = () => {
      scriptLoaded.current = true;
      if (typeof window.zE === 'function') {
        // Position bottom-left, set label
        window.zE('webWidget', 'updateSettings', {
          webWidget: {
            position: { horizontal: 'left', vertical: 'bottom' },
            launcher: {
              label: { '*': 'Help' },
            },
            helpCenter: {
              title: { '*': 'Help' },
            },
            color: { launcher: '#1d4ed8', launcherText: '#ffffff' },
          },
        });
        // Set initial suggestions
        const terms = getSearchTerms(location.pathname);
        window.zE('webWidget', 'helpCenter', 'setSuggestions', {
          search: terms,
        });
      }
    };

    document.head.appendChild(script);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update suggestions on route change
  useEffect(() => {
    if (typeof window.zE !== 'function') return;
    const terms = getSearchTerms(location.pathname);
    window.zE('webWidget', 'helpCenter', 'setSuggestions', {
      search: terms,
    });
  }, [location.pathname]);

  // No DOM output — the Zendesk widget manages its own UI
  return null;
}
