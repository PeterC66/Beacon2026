// beacon2/frontend/src/pages/groups/TeamList.jsx

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { teams as teamsApi, polls as pollsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const DOWNLOAD_FIELDS = [
  { key: 'name',         label: 'Team',        default: true },
  { key: 'leaders',      label: 'Leader(s)',   default: true },
  { key: 'member_count', label: 'Members',     default: true },
  { key: 'status',       label: 'Status',      default: false },
  { key: 'information',  label: 'Information', default: false },
];

export default function TeamList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [teamList,    setTeamList]    = useState([]);
  const { sorted, sortKey, sortDir, onSort } = useSortedData(teamList);
  const [polls,       setPolls]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const tableRef = useRef(null);

  const [activeOnly,   setActiveOnly]  = useState(true);
  const [letter,       setLetter]      = useState('');

  // Selection + bulk actions
  const [selected,      setSelected]      = useState(new Set());
  const [bulkAction,    setBulkAction]    = useState('');
  const [addToPollId,   setAddToPollId]   = useState('');
  const [bulkWorking,   setBulkWorking]   = useState(false);
  const [bulkResult,    setBulkResult]    = useState(null);

  // Downloads
  const [dlFields,      setDlFields]      = useState(new Set(DOWNLOAD_FIELDS.filter((f) => f.default).map((f) => f.key)));
  const [downloading,   setDownloading]   = useState(false);
  const [dlError,       setDlError]       = useState(null);

  useEffect(() => {
    pollsApi.list().then(setPolls).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [activeOnly, letter]);

  async function load() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setBulkResult(null);
    try {
      const data = await teamsApi.list({ activeOnly, letter });
      setTeamList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLetterClick(l) {
    setLetter(l === letter ? '' : l);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll()   { setSelected(new Set(sorted.map((t) => t.id))); }
  function clearAll()    { setSelected(new Set()); }

  async function handleBulkDo() {
    if (selected.size === 0) return;
    if (bulkAction === 'send_email_leaders') {
      const leaderMemberIds = new Set();
      for (const tId of selected) {
        const team = sorted.find((t) => t.id === tId);
        if (team?.leaders) {
          for (const l of team.leaders) {
            if (l.id) leaderMemberIds.add(l.id);
          }
        }
      }
      if (leaderMemberIds.size === 0) {
        setBulkResult({ type: 'error', msg: 'No leaders found for the selected teams.' });
        return;
      }
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([...leaderMemberIds]));
      navigate('/email/compose');
      return;
    }
    if (bulkAction === 'add_members_to_poll') {
      if (!addToPollId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const memberIds = new Set();
        for (const tId of selected) {
          const members = await teamsApi.listMembers(tId);
          for (const m of members) memberIds.add(m.member_id);
        }
        if (memberIds.size === 0) {
          setBulkResult({ type: 'error', msg: 'No members found in the selected teams.' });
          return;
        }
        const result = await pollsApi.addMembers(addToPollId, [...memberIds]);
        const pollName = polls.find((p) => p.id === addToPollId)?.name ?? 'poll';
        setBulkResult({ type: 'success', msg: `${result.added} member${result.added !== 1 ? 's' : ''} added to "${pollName}".` });
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
    }
  }

  function toggleDlField(key) {
    setDlFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDownload(format) {
    const ids = selected.size > 0 ? [...selected] : sorted.map((t) => t.id);
    const fields = DOWNLOAD_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
    setDownloading(true);
    setDlError(null);
    try {
      await teamsApi.download(format, ids, fields);
    } catch (err) {
      setDlError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const hasBulkPolls = can('poll_set_up', 'change') && polls.length > 0;

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('group_records_all', 'create') ? [{ label: 'Add New Team', to: '/teams/new' }] : []),
    { label: 'Groups', to: '/groups' },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">Teams</h1>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-3 flex flex-wrap gap-4 items-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show active only
          </label>
        </div>

        {/* ── Letter navigation ─────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 mb-3">
          <button
            onClick={() => handleLetterClick('')}
            className={`px-2 py-0.5 text-sm rounded border ${letter === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            All
          </button>
          {ALPHABET.map((l) => (
            <button
              key={l}
              onClick={() => handleLetterClick(l)}
              className={`px-2 py-0.5 text-sm rounded border ${letter === l ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── Results ───────────────────────────────────────────────── */}
        {error   && <p className="text-center text-red-600 mb-3">Error: {error}</p>}
        {loading && <p className="text-center text-slate-500 py-8">Loading...</p>}

        {!loading && !error && (
          teamList.length === 0 ? (
            <p className="text-center text-slate-500 py-6">No teams found.</p>
          ) : (
            <>
              {/* Select controls */}
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="text-sm text-slate-500">{teamList.length} team{teamList.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-medium text-slate-600">Select:</span>
                <button onClick={selectAll} className="text-sm text-blue-700 hover:underline">All</button>
                <button onClick={clearAll}  className="text-sm text-blue-700 hover:underline">Clear All</button>
                {selected.size > 0 && (
                  <span className="text-sm font-medium text-blue-700 ml-2">{selected.size} selected</span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg shadow-sm mb-3" ref={tableRef}>
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className="px-2 py-2"></th>
                      <SortableHeader col="name"         label="Team"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <th className="px-3 py-2 font-normal">Leader(s)</th>
                      <SortableHeader col="member_count" label="Members" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      {!activeOnly && <SortableHeader col="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />}
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t, i) => (
                      <tr
                        key={t.id}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} ${selected.has(t.id) ? 'outline outline-2 outline-blue-400' : ''}`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {can('group_records_all', 'view') ? (
                            <Link to={`/teams/${t.id}`} title={t.short_name ? t.name : undefined} className="text-blue-700 hover:underline">
                              {t.short_name || t.name}
                            </Link>
                          ) : <span title={t.short_name ? t.name : undefined}>{t.short_name || t.name}</span>}
                          {t.status === 'inactive' && (
                            <span className="ml-2 text-xs text-red-500">(inactive)</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {(t.leaders ?? []).map((l) => `${l.forenames} ${l.surname}`).join(', ')}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{t.member_count ?? 0}</td>
                        {!activeOnly && (
                          <td className="px-3 py-2">
                            <span className={t.status === 'active' ? 'text-green-700' : 'text-red-600'}>
                              {t.status}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          {can('group_records_all', 'view') && (
                            <Link to={`/teams/${t.id}`} className="text-blue-700 hover:underline text-xs">
                              Edit
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Bulk actions ──────────────────────────────────────── */}
              {selected.size > 0 && (
                <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected team{selected.size !== 1 ? 's' : ''}</label>
                      <select
                        name="bulkAction"
                        value={bulkAction}
                        onChange={(e) => { setBulkAction(e.target.value); setBulkResult(null); setDlError(null); }}
                        className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— choose action —</option>
                        {can('email', 'send') && <option value="send_email_leaders">Send email to leaders</option>}
                        <option value="download_excel">Download Excel</option>
                        <option value="download_pdf">Download PDF</option>
                        {hasBulkPolls && <option value="add_members_to_poll">Add members to poll</option>}
                      </select>
                    </div>

                    {bulkAction === 'add_members_to_poll' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
                        <select
                          name="addToPollId"
                          value={addToPollId}
                          onChange={(e) => setAddToPollId(e.target.value)}
                          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— select poll —</option>
                          {polls.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}

                    {(bulkAction === 'send_email_leaders' || bulkAction === 'add_members_to_poll') && (
                      <button
                        onClick={handleBulkDo}
                        disabled={bulkWorking || (bulkAction === 'add_members_to_poll' && !addToPollId)}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                      >
                        {bulkWorking ? 'Working...' : 'Do with selected'}
                      </button>
                    )}

                    {bulkResult && (
                      <p className={`text-sm font-medium ${bulkResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                        {bulkResult.msg}
                      </p>
                    )}
                    {dlError && <p className="text-sm text-red-600 font-medium">{dlError}</p>}
                  </div>

                  {/* Field picker for Excel / PDF downloads */}
                  {(bulkAction === 'download_excel' || bulkAction === 'download_pdf') && (
                    <div className="border border-slate-200 rounded p-3 bg-slate-50">
                      <p className="text-sm font-medium text-slate-700 mb-2">Fields to include:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mb-3">
                        {DOWNLOAD_FIELDS.map((f) => (
                          <label key={f.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="checkbox" checked={dlFields.has(f.key)}
                              onChange={() => toggleDlField(f.key)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            {f.label}
                          </label>
                        ))}
                      </div>
                      <button onClick={() => handleDownload(bulkAction === 'download_excel' ? 'excel' : 'pdf')}
                        disabled={downloading || dlFields.size === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                        {downloading ? 'Downloading...' : `Download ${bulkAction === 'download_excel' ? 'Excel' : 'PDF'}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>

      <NavBar links={navLinks} />
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
