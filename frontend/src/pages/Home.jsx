// beacon2/frontend/src/pages/Home.jsx
// Landing page after login — main administration menu.

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { settings as settingsApi } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

export default function Home() {
  const { user, tenant, logout, can } = useAuth();
  const navigate = useNavigate();

  const [homeInfo, setHomeInfo] = useState(null);

  useEffect(() => {
    settingsApi.getHomeInfo().then(setHomeInfo).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sections = [
    {
      title: 'Membership',
      items: [
        { label: 'Members',             tip: 'Search, view and edit member records', to: can('members_list', 'view')   ? '/members'     : null },
        { label: 'Add new member',      tip: 'Create a new member record',          to: can('member_record', 'create') ? '/members/new' : null },
        { label: 'Membership renewals', tip: 'Process annual membership renewals',  to: can('membership_renewals', 'view') ? '/membership/renewals' : null },
        { label: 'Recent members',      tip: 'View recently added or changed members', to: can('members_recent', 'view') ? '/members/recent' : null },
        { label: 'Non-renewals',        tip: 'View and lapse members who have not renewed', to: can('members_non_renewals', 'view') ? '/membership/non-renewals' : null },
        { label: 'Membership cards',    tip: 'Generate and download membership cards', to: can('membership_cards', 'view') ? '/membership/cards' : null },
        { label: 'Addresses export',    tip: 'Export member addresses for labels or mail merge', to: can('addresses_export', 'view') ? '/addresses-export' : null },
        { label: 'Statistics',          tip: 'Membership counts and trends',        to: can('membership_statistics', 'view') ? '/members/statistics' : null },
      ],
    },
    {
      title: 'Groups',
      items: [
        { label: 'Groups',    tip: 'View and manage interest groups',              to: can('groups_list',    'view') ? '/groups'    : null },
        { label: 'Venues',    tip: 'Manage venues where groups meet',              to: can('group_venues',   'view') ? '/venues'    : null },
        { label: 'Faculties', tip: 'Organise groups into subject categories',      to: can('group_faculties','view') ? '/faculties' : null },
        { label: 'Calendar',  tip: 'View group meetings in a calendar format',     to: can('calendar', 'view') ? '/calendar' : null },
        { label: 'Teams',     tip: 'View and manage teams',                        to: can('groups_list',    'view') ? '/teams'     : null },
      ],
    },
    {
      title: 'Finance',
      items: [
        { label: 'Ledger (by account)',  tip: 'View transactions listed by bank account',    to: can('finance_ledger', 'view') ? '/finance/ledger?view=account'  : null },
        { label: 'Ledger (by category)', tip: 'View transactions listed by income/expense category', to: can('finance_ledger', 'view') ? '/finance/ledger?view=category' : null },
        { label: 'Ledger (by group)',    tip: 'View transactions listed by interest group',  to: can('finance_ledger', 'view') ? '/finance/ledger?view=group'    : null },
        { label: 'Add transaction',      tip: 'Record a new payment or receipt',             to: can('finance_transactions', 'create') ? '/finance/transactions/new' : null },
        { label: 'Transfer money',       tip: 'Transfer funds between accounts',             to: can('finance_transfer_money', 'view') ? '/finance/transfers' : null },
        { label: 'Credit batches',       tip: 'Process batches of member credits',           to: can('finance_batches', 'view') ? '/finance/batches' : null },
        { label: 'Reconcile account',    tip: 'Match transactions against bank statements',  to: can('finance_reconcile', 'view') ? '/finance/reconcile' : null },
        { label: 'Financial statement',  tip: 'Summary of income and expenditure by period', to: can('finance_statement', 'view') ? '/finance/statement' : null },
        { label: 'Groups statement',     tip: 'Financial summary broken down by group',      to: can('group_statement', 'view') ? '/finance/groups-statement' : null },
        { label: 'Gift Aid declaration', tip: 'Generate Gift Aid declarations for HMRC',     to: can('gift_aid_declaration', 'view') ? '/finance/gift-aid' : null },
      ],
    },
    {
      title: 'Misc',
      items: [
        { label: 'Audit log',             tip: 'Review a log of changes made by users',       to: can('audit_trail', 'view') ? '/audit' : null },
        { label: 'Gift aid log',          tip: 'View history of Gift Aid declarations sent',   to: can('gift_aid_declaration', 'view') ? '/gift-aid-log' : null },
        { label: 'u3a Officers',          tip: 'Manage committee and officer appointments',    to: can('offices', 'view') ? '/officers' : null },
        { label: 'Public links',          tip: 'Configure online joining and members portal',  to: can('public_links', 'view') ? '/public-links' : null },
        { label: 'Data export & backup',  tip: 'Export data or back up the database',          to: can('data_export_backup', 'view') ? '/backup' : null },
        { label: 'E-mail delivery',       tip: 'Track the status of sent emails',              to: can('email_delivery', 'view') ? '/email/delivery' : null },
        { label: 'E-mail unblocker',      tip: 'Remove members from the email block list',     to: can('email_delivery', 'all')  ? '/email/unblocker' : null },
        { label: 'Personal preferences',  tip: 'Change your password, name display and timeout settings', to: '/preferences' },
        { label: 'Utilities',              tip: 'Administrative utilities',                                to: can('utilities', 'view') ? '/utilities' : null },
      ],
    },
    {
      title: 'Set up',
      items: [
        { label: 'System users',        tip: 'Manage who can log in and their access',       to: can('users_list', 'view') ? '/users' : null },
        { label: 'Roles and privileges', tip: 'Define roles and what each role can do',       to: can('role_record', 'view') ? '/roles' : null },
        { label: 'System settings',     tip: 'Configure u3a name, financial year and other settings', to: can('settings', 'view') ? '/settings' : null },
        { label: 'System messages',     tip: 'Edit standard email and letter templates',      to: can('system_messages', 'view') ? '/system-messages' : null },
        { label: 'Finance accounts',    tip: 'Set up bank accounts and payment methods',     to: can('finance_accounts', 'view') ? '/finance/accounts' : null },
        { label: 'Finance categories',  tip: 'Set up income and expenditure categories',     to: can('finance_categories', 'view') ? '/finance/categories' : null },
        { label: 'Membership classes',  tip: 'Define membership types and their fees',       to: can('member_classes',  'view') ? '/membership/classes'  : null },
        { label: 'Member statuses',     tip: 'View the lifecycle statuses for members',      to: can('member_statuses', 'view') ? '/membership/statuses' : null },
        { label: 'Poll',                tip: 'Set up and manage membership polls',            to: can('poll_set_up', 'view') ? '/polls' : null },
        { label: 'Custom fields',      tip: 'Define up to 4 free-form fields on member records', to: can('custom_fields', 'view') ? '/custom-fields' : null },
      ],
    },
  ];

  const tenantName = homeInfo?.tenantName ?? '';

  // Public website links use the tenant slug
  const publicLinks = [
    { label: `Join ${tenantName || 'us'} now!`, to: `/public/${tenant}/join` },
    { label: 'Members Portal', to: `/public/${tenant}/portal` },
    { label: 'Public groups list', to: `/public/${tenant}/groups` },
    { label: 'Public calendar', to: `/public/${tenant}/calendar` },
  ];

  return (
    <div className="min-h-screen pb-10">

      <PageHeader tenant={tenant} />

      <div className="text-center py-3 px-4 bg-white/50 backdrop-blur-sm border-b border-white/50">
        <h1 className="text-xl font-bold">Administration</h1>
        <p className="text-sm text-slate-700 mt-1">
          You are logged in as {user?.name ?? user?.email ?? ''}
          {'  '}
          <button
            onClick={handleLogout}
            className="text-blue-700 hover:underline bg-transparent border-0 cursor-pointer text-sm p-0 ml-1"
          >
            Log Out
          </button>
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-4">

        {/* Mobile: stacked sections (single column) */}
        <div className="md:hidden space-y-3">
          {sections.map((section) => (
            <div key={section.title} className="bg-white/85 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-amber-100 to-amber-200 px-4 py-2 font-bold text-sm border-b border-amber-200">
                {section.title}
              </div>
              <ul className="divide-y divide-slate-100">
                {section.items.map((item) => (
                  <li key={item.label} className="px-4 py-2.5 text-sm">
                    {item.to
                      ? <Link to={item.to} title={item.tip} className="text-blue-700 hover:underline">{item.label}</Link>
                      : <span title={item.tip} className="text-slate-400">{item.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Desktop: 5-column grid */}
        <div className="hidden md:grid grid-cols-5 bg-gradient-to-br from-yellow-50 to-amber-100 border border-slate-300 rounded-lg overflow-hidden shadow-sm">
          {sections.map((section, si) => (
            <div key={section.title} className={`${si < sections.length - 1 ? 'border-r border-slate-300' : ''}`}>
              <div className="font-bold text-sm px-4 py-2 border-b border-slate-300 bg-gradient-to-r from-amber-100 to-amber-200 whitespace-nowrap">
                {section.title}
              </div>
              <ul>
                {section.items.map((item) => (
                  <li key={item.label} className="px-4 py-1 text-sm border-b border-slate-200 last:border-b-0 whitespace-nowrap">
                    {item.to
                      ? <Link to={item.to} title={item.tip} className="text-blue-700 hover:underline">{item.label}</Link>
                      : <span title={item.tip} className="text-slate-400">{item.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Links & Messages panel ─────────────────────────────────── */}
        <div className="mt-4 bg-gradient-to-br from-yellow-50 to-amber-100 border border-slate-300 rounded-lg overflow-hidden shadow-sm">

          {/* Fixed links row */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 px-4 py-2 border-b border-slate-300 text-sm">
            <a href="https://forum.u3abeacon.org.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline" title="Go to the u3a Beacon Users' Forum for support on using Beacon, to give feedback on bugs and usability and to suggest new features">u3a Beacon Users' Forum</a>
            <a href="https://u3abeacon.zendesk.com/hc/en-gb" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline" title="Display the u3a Beacon User Guide to assist your use of the system">Beacon User Guide</a>
            <a href="https://beacon.u3a.org.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline" title="Visit the Beacon website for news, training and support">Beacon Website</a>
          </div>

          {/* Public website links row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 border-b border-slate-300 text-sm">
            <span className="font-bold text-sm whitespace-nowrap">Public website links</span>
            {publicLinks.map((link) => (
              link.to
                ? <Link key={link.label} to={link.to} className="text-blue-700 hover:underline">{link.label}</Link>
                : <span key={link.label} className="text-slate-400">{link.label}</span>
            ))}
          </div>

          {/* Documents row (hidden for now — may be needed later) */}
          {false && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-sm">
            <span className="font-bold text-sm whitespace-nowrap">Documents</span>
            <a href="https://beacon.u3a.org.uk/engagement" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Documentation for prospective Beacon users</a>
          </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 italic mt-2">
          Hover mouse over captions for more information
        </p>

        {/* ── Messages ───────────────────────────────────────────────── */}
        {homeInfo && (homeInfo.systemMessage || homeInfo.homeNotice) && (
          <div className="mt-3 bg-white/90 border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
            {homeInfo.systemMessage && (
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{homeInfo.systemMessage}</p>
            )}
            {homeInfo.homeNotice && (
              <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{homeInfo.homeNotice}</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
