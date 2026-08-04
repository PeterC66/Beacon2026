// beacon2026/frontend/src/pages/groups/GroupRecord.jsx
// Group record page with Details, Members, and Schedule tabs.
// Route /groups/new → create mode (Details only, no tabs)
// Route /groups/:id → view/edit mode with Details + Members + Schedule tabs

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  groups as groupsApi,
  faculties as facultiesApi,
  venues as venuesApi,
} from '../../lib/api.js';
import Schedule from '../../components/Schedule.jsx';
import EntityMembers from '../../components/EntityMembers.jsx';
import StdEmailsTab from '../../components/StdEmailsTab.jsx';
import StdLettersTab from '../../components/StdLettersTab.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import GroupDetails from './GroupDetails.jsx';
import GroupLedger from './GroupLedger.jsx';

// ─── GroupRecord page ─────────────────────────────────────────────────────

export default function GroupRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, tenant, hasFeature } = useAuth();
  const [faculties, setFaculties] = useState([]);
  const [allVenues, setAllVenues] = useState([]);
  const [groupName, setGroupName] = useState('');

  const siteworksActivated = hasFeature('siteworks');
  const isNew = id === undefined;
  const activeTab = searchParams.get('tab') ?? 'details';

  useEffect(() => {
    facultiesApi
      .list()
      .then(setFaculties)
      .catch(() => {});
    venuesApi
      .list()
      .then(setAllVenues)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew) {
      groupsApi
        .get(id)
        .then((g) => setGroupName(g.name))
        .catch(() => {});
    }
  }, [id]);

  function handleSaved(result) {
    if (isNew) {
      navigate(`/groups/${result.id}`);
    } else {
      setGroupName(result.name ?? groupName);
    }
  }

  function handleDeleted() {
    navigate('/groups');
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Groups', to: '/groups' },
    ...(can('group_records_all', 'create') ? [{ label: 'Add New Group', to: '/groups/new' }] : []),
  ];

  const tabs = [
    { key: 'details', label: 'Details', available: true },
    { key: 'members', label: 'Members', available: !isNew },
    {
      key: 'schedule',
      label: 'Events',
      available: !isNew && !siteworksActivated && hasFeature('events'),
    },
    {
      key: 'ledger',
      label: 'Group Cash',
      available:
        !isNew &&
        hasFeature('groupLedger') &&
        (can('group_ledger_all', 'view') || can('group_ledger_as_leader', 'view')),
    },
    {
      key: 'std-emails',
      label: 'Std Emails',
      available:
        !isNew &&
        hasFeature('email') &&
        (can('email_standard_messages_all', 'view') ||
          can('email_standard_messages_as_leader', 'view')),
    },
    {
      key: 'std-letters',
      label: 'Std Letters',
      available:
        !isNew &&
        hasFeature('letters') &&
        (can('letters_standard_messages_all', 'view') ||
          can('letters_standard_messages_as_leader', 'view')),
    },
  ];

  // Details is a long form and doesn't benefit from full width; the other
  // tabs are table-heavy and get a wider cap so their columns aren't cramped.
  const wrapperMaxW = !isNew && activeTab !== 'details' ? 'max-w-7xl' : 'max-w-4xl';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className={`${wrapperMaxW} mx-auto px-4 py-4`}>
        {/* Title */}
        <h1 className="text-xl font-bold text-center mb-3">
          {isNew ? 'Add New Group' : groupName || 'Group Record'}
        </h1>

        {/* Tab navigation (only when editing existing) */}
        {!isNew && (
          <div role="tablist" className="flex gap-0 mb-4 border-b border-slate-300">
            {tabs
              .filter((tab) => tab.available)
              .map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setSearchParams(tab.key === 'details' ? {} : { tab: tab.key })}
                  className={[
                    'px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
          </div>
        )}

        {/* Tab content */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
          {(isNew || activeTab === 'details') && (
            <GroupDetails
              groupId={isNew ? null : id}
              faculties={faculties}
              venues={allVenues}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              siteworksActivated={siteworksActivated}
            />
          )}
          {!isNew && activeTab === 'members' && (
            <EntityMembers entityId={id} api={groupsApi} entityType="group" />
          )}
          {!isNew && activeTab === 'schedule' && !siteworksActivated && (
            <Schedule entityId={id} api={groupsApi} />
          )}
          {!isNew && activeTab === 'ledger' && <GroupLedger groupId={id} />}
          {!isNew && activeTab === 'std-emails' && <StdEmailsTab entityId={id} api={groupsApi} />}
          {!isNew && activeTab === 'std-letters' && <StdLettersTab entityId={id} api={groupsApi} />}
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
