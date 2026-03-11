// beacon2/frontend/src/pages/Home.jsx
// Landing page after login — main administration menu.

import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Home() {
  const { user, tenant, logout, can } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sections = [
    {
      title: 'Membership',
      items: [
        { label: 'Members',             to: can('members_list', 'view')   ? '/members'     : null },
        { label: 'Add new member',      to: can('member_record', 'create') ? '/members/new' : null },
        { label: 'Membership renewals', to: null },
        { label: 'Recent members',      to: null },
        { label: 'Non-renewals',        to: null },
        { label: 'Membership cards',    to: null },
        { label: 'Addresses export',    to: null },
        { label: 'Statistics',          to: null },
      ],
    },
    {
      title: 'Groups',
      items: [
        { label: 'Groups',    to: can('groups_list', 'view') ? '/groups' : null },
        { label: 'Venues',    to: null },
        { label: 'Faculties', to: null },
        { label: 'Calendar',  to: null },
      ],
    },
    {
      title: 'Finance',
      items: [
        { label: 'Ledger (by account)',  to: can('finance_ledger', 'view') ? '/finance/ledger?view=account'  : null },
        { label: 'Ledger (by category)', to: can('finance_ledger', 'view') ? '/finance/ledger?view=category' : null },
        { label: 'Ledger (by group)',    to: can('finance_ledger', 'view') ? '/finance/ledger?view=group'    : null },
        { label: 'Add transaction',      to: can('finance_transactions', 'create') ? '/finance/transactions/new' : null },
        { label: 'Transfer money',       to: null },
        { label: 'Credit batches',       to: null },
        { label: 'Reconcile account',    to: null },
        { label: 'Financial statement',  to: null },
        { label: 'Gift Aid declaration', to: null },
      ],
    },
    {
      title: 'Misc',
      items: [
        { label: 'Audit log',             to: null },
        { label: 'Gift aid log',          to: null },
        { label: 'u3a Officers',          to: null },
        { label: 'Public links',          to: null },
        { label: 'Data export & backup',  to: null },
        { label: 'E-mail delivery',       to: null },
        { label: 'Personal preferences',  to: null },
        { label: 'Validate member data',  to: can('member_data_validation', 'view') ? '/admin/validate-members' : null },
      ],
    },
    {
      title: 'Set up',
      items: [
        { label: 'System users',        to: can('users_list', 'view') ? '/users' : null },
        { label: 'Roles and privileges', to: can('role_record', 'view') ? '/roles' : null },
        { label: 'System settings',     to: can('settings', 'view') ? '/settings' : null },
        { label: 'System messages',     to: null },
        { label: 'Finance accounts',    to: can('finance_accounts', 'view') ? '/finance/accounts' : null },
        { label: 'Finance categories',  to: can('finance_categories', 'view') ? '/finance/categories' : null },
        { label: 'Membership classes',  to: can('member_classes',  'view') ? '/membership/classes'  : null },
        { label: 'Member statuses',     to: can('member_statuses', 'view') ? '/membership/statuses' : null },
        { label: 'Poll',                to: can('poll_set_up', 'view') ? '/polls' : null },
      ],
    },
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
                      ? <Link to={item.to} className="text-blue-700 hover:underline">{item.label}</Link>
                      : <span className="text-slate-400">{item.label}</span>}
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
                      ? <Link to={item.to} className="text-blue-700 hover:underline">{item.label}</Link>
                      : <span className="text-slate-400">{item.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 italic mt-2">
          Hover mouse over captions for more information
        </p>

      </div>
    </div>
  );
}
