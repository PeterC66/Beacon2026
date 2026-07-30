// beacon2026/frontend/src/pages/teams/TeamRecord.jsx
// Team record page with Details, Members, and Ledger tabs.
// Route /teams/new → create mode (Details only, no tabs)
// Route /teams/:id → view/edit mode with Details + Members + Ledger tabs

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { teams as teamsApi } from '../../lib/api.js';
import Schedule from '../../components/Schedule.jsx';
import EntityMembers from '../../components/EntityMembers.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TeamDetails from './TeamDetails.jsx';
import TeamLedger from './TeamLedger.jsx';

// ─── TeamRecord page ─────────────────────────────────────────────────────

export default function TeamRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, tenant, hasFeature } = useAuth();
  const [teamName, setTeamName] = useState('');

  const isNew = id === undefined;
  const activeTab = searchParams.get('tab') ?? 'details';

  useEffect(() => {
    if (!isNew) {
      teamsApi
        .get(id)
        .then((t) => setTeamName(t.name))
        .catch(() => {});
    }
  }, [id]);

  function handleSaved(result) {
    if (isNew) {
      navigate(`/teams/${result.id}`);
    } else {
      setTeamName(result.name ?? teamName);
    }
  }

  function handleDeleted() {
    navigate('/teams');
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Teams', to: '/teams' },
    ...(can('group_records_all', 'create') ? [{ label: 'Add New Team', to: '/teams/new' }] : []),
  ];

  const tabs = [
    { key: 'details', label: 'Details', available: true },
    { key: 'members', label: 'Members', available: !isNew },
    { key: 'schedule', label: 'Events', available: !isNew && hasFeature('events') },
    {
      key: 'ledger',
      label: 'Team Cash',
      available:
        !isNew &&
        hasFeature('groupLedger') &&
        (can('group_ledger_all', 'view') || can('group_ledger_as_leader', 'view')),
    },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Title */}
        <h1 className="text-xl font-bold text-center mb-3">
          {isNew ? 'Add New Team' : teamName || 'Team Record'}
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
            <TeamDetails
              teamId={isNew ? null : id}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          )}
          {!isNew && activeTab === 'members' && (
            <EntityMembers entityId={id} api={teamsApi} entityType="team" />
          )}
          {!isNew && activeTab === 'schedule' && <Schedule entityId={id} api={teamsApi} />}
          {!isNew && activeTab === 'ledger' && <TeamLedger teamId={id} />}
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
