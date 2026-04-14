// beacon2/frontend/src/pages/members/MemberList.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi, polls as pollsApi, groups as groupsApi, teams as teamsApi, settings as settingsApi } from '../../lib/api.js';

const DOWNLOAD_FIELDS = [
  { key: 'membership_number', label: 'Membership No', default: true },
  { key: 'title',             label: 'Title',         default: false },
  { key: 'forenames',         label: 'Forenames',     default: true },
  { key: 'known_as',          label: 'Known As',      default: false },
  { key: 'surname',           label: 'Surname',       default: true },
  { key: 'email',             label: 'Email',         default: true },
  { key: 'mobile',            label: 'Mobile',        default: true },
  { key: 'telephone',         label: 'Telephone',     default: false },
  { key: 'address',           label: 'Address',       default: false },
  { key: 'town',              label: 'Town',          default: true },
  { key: 'county',            label: 'County',        default: false },
  { key: 'postcode',          label: 'Postcode',      default: true },
  { key: 'country',           label: 'Country',       default: false },
  { key: 'status',            label: 'Status',        default: true },
  { key: 'class',             label: 'Class',         default: true },
  { key: 'joined_on',         label: 'Joined',        default: false },
  { key: 'next_renewal',      label: 'Next Renewal',  default: false },
  { key: 'custom_field_1',    label: 'Custom Field 1', default: false },
  { key: 'custom_field_2',    label: 'Custom Field 2', default: false },
  { key: 'custom_field_3',    label: 'Custom Field 3', default: false },
  { key: 'custom_field_4',    label: 'Custom Field 4', default: false },
];
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { formatShortAddress, isSubscriptionOverdue } from '../../lib/memberFormatters.js';
import { formatMemberName } from '../../hooks/usePreferences.js';
import NoEmailIcon from '../../components/NoEmailIcon.jsx';
import { ALL_PAYMENT_METHODS as PAYMENT_METHODS } from '../../lib/constants.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function MemberList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [memberList,  setMemberList]  = useState([]);
  const SORT_SURNAME = ['surname', 'forenames'];
  const { sorted, sortKey, sortDir, onSort } = useSortedData(memberList, SORT_SURNAME, 'asc');
  const [statuses,    setStatuses]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [polls,       setPolls]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedClass,    setSelectedClass]    = useState('');
  const [selectedPoll,     setSelectedPoll]     = useState('');
  const [negatePoll,       setNegatePoll]       = useState(false);
  const [letter,           setLetter]           = useState('');
  const [searchInput,      setSearchInput]      = useState('');
  const [activeSearch,     setActiveSearch]     = useState('');
  const [cfInput,          setCfInput]          = useState('');
  const [activeCf,         setActiveCf]         = useState('');
  const [cfLabels,         setCfLabels]         = useState({ label1: '', label2: '', label3: '', label4: '' });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  // Selection + bulk actions
  const [selected,      setSelected]      = useState(new Set());
  const [bulkAction,    setBulkAction]    = useState('');
  const [addToPollId,   setAddToPollId]   = useState('');
  const [addToGroupId,  setAddToGroupId]  = useState('');
  const [allGroups,     setAllGroups]     = useState([]);
  const [addToTeamId,   setAddToTeamId]   = useState('');
  const [allTeams,      setAllTeams]      = useState([]);
  const [bulkWorking,   setBulkWorking]   = useState(false);
  const [bulkResult,    setBulkResult]    = useState(null);

  // Downloads
  const [dlFields,      setDlFields]      = useState(new Set(DOWNLOAD_FIELDS.filter((f) => f.default).map((f) => f.key)));
  const [downloading,   setDownloading]   = useState(false);
  const [dlError,       setDlError]       = useState(null);

  // Row refs for letter-jump
  const rowRefs = useRef({});
  const tableRef = useRef(null);

  // Load statuses, classes, polls, groups once
  useEffect(() => {
    Promise.all([statusApi.list(), classApi.list(), pollsApi.list()])
      .then(([s, c, p]) => {
        setStatuses(s);
        setClasses(c);
        setPolls(p);
        const current = s.find((x) => x.name === 'Current');
        if (current) setSelectedStatuses([current.id]);
      })
      .catch(() => {});
    settingsApi.getCustomFieldLabels().then(setCfLabels).catch(() => {});
    groupsApi.list({ activeOnly: true }).then(setAllGroups).catch(() => {});
    teamsApi.list({ activeOnly: true }).then(setAllTeams).catch(() => {});
  }, []);

  // Load members whenever filters change
  useEffect(() => { load(); }, [selectedStatuses, selectedClass, selectedPoll, negatePoll, letter, activeSearch, activeCf, selectedPaymentMethod]);

  async function load() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setBulkResult(null);
    try {
      const data = await membersApi.list({
        status:     selectedStatuses.join(','),
        classId:    selectedClass,
        pollId:     selectedPoll,
        negatePoll: negatePoll && selectedPoll ? true : false,
        letter,
        q:          activeSearch,
        cf:         activeCf,
        paymentMethod: selectedPaymentMethod,
      });
      setMemberList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleStatus(id) {
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSearch(e) {
    e.preventDefault();
    setActiveSearch(searchInput);
    setLetter('');
  }

  function handleCancelSearch() {
    setSearchInput('');
    setActiveSearch('');
    setCfInput('');
    setActiveCf('');
  }

  function handleCfSearch(e) {
    e.preventDefault();
    setActiveCf(cfInput);
    setLetter('');
  }

  function handleCancelCf() {
    setCfInput('');
    setActiveCf('');
  }

  function handleLetterClick(l) {
    setLetter(l === letter ? '' : l);
    setActiveSearch('');
    setSearchInput('');
  }

  // Selection helpers
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll()            { setSelected(new Set(sorted.map((m) => m.id))); }
  function clearAll()             { setSelected(new Set()); }
  function selectEmail()          { setSelected(new Set(sorted.filter((m) => m.email).map((m) => m.id))); }
  function selectNoEmail()        { setSelected(new Set(sorted.filter((m) => !m.email).map((m) => m.id))); }
  function selectPortalPassword() { setSelected(new Set(sorted.filter((m) => m.has_portal_password).map((m) => m.id))); }
  function selectNoPortalPassword() { setSelected(new Set(sorted.filter((m) => !m.has_portal_password).map((m) => m.id))); }
  function selectEmailNotConfirmed() { setSelected(new Set(sorted.filter((m) => m.has_portal_password && !m.portal_email_verified).map((m) => m.id))); }

  async function handleBulkDo() {
    if (selected.size === 0) return;
    if (bulkAction === 'send_email') {
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([...selected]));
      navigate('/email/compose');
      return;
    }
    if (bulkAction === 'send_letter') {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([...selected]));
      navigate('/letters/compose');
      return;
    }
    if (bulkAction === 'add_to_poll') {
      if (!addToPollId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await pollsApi.addMembers(addToPollId, [...selected]);
        const pollName = polls.find((p) => p.id === addToPollId)?.name ?? 'poll';
        setBulkResult({ type: 'success', msg: `${result.added} member${result.added !== 1 ? 's' : ''} added to "${pollName}".` });
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
    }
    if (bulkAction === 'add_to_group') {
      if (!addToGroupId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await groupsApi.bulkAddMembers(addToGroupId, [...selected]);
        const groupName = allGroups.find((g) => g.id === addToGroupId)?.name ?? 'group';
        const parts = [];
        if (result.added)      parts.push(`${result.added} added`);
        if (result.waitlisted) parts.push(`${result.waitlisted} waitlisted`);
        if (result.skipped)    parts.push(`${result.skipped} already in group`);
        setBulkResult({ type: 'success', msg: `"${groupName}": ${parts.join(', ')}.` });
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
    }
    if (bulkAction === 'add_to_team') {
      if (!addToTeamId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await teamsApi.bulkAddMembers(addToTeamId, [...selected]);
        const teamName = allTeams.find((t) => t.id === addToTeamId)?.name ?? 'team';
        const parts = [];
        if (result.added)   parts.push(`${result.added} added`);
        if (result.skipped) parts.push(`${result.skipped} already in team`);
        setBulkResult({ type: 'success', msg: `"${teamName}": ${parts.join(', ')}.` });
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
    const ids = selected.size > 0 ? [...selected] : sorted.map((m) => m.id);
    const fields = format === 'email-csv' ? [] : DOWNLOAD_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
    setDownloading(true);
    setDlError(null);
    try {
      await membersApi.download(format, ids, fields);
    } catch (err) {
      setDlError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  // Custom field labels — derived values for the filter UI
  const hasCfLabels = !!(cfLabels.label1 || cfLabels.label2 || cfLabels.label3 || cfLabels.label4);
  const cfLabelNames = [cfLabels.label1, cfLabels.label2, cfLabels.label3, cfLabels.label4]
    .filter(Boolean).join(', ');

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('member_record', 'create') ? [{ label: 'Add New Member', to: '/members/new' }] : []),
  ];

  const hasBulkPolls = can('poll_set_up', 'change') && polls.length > 0;
  const hasBulkGroups = can('group_records_all', 'change') && allGroups.length > 0;
  const hasBulkTeams  = can('group_records_all', 'change') && allTeams.length > 0;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">Members</h1>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-3 space-y-3">

          {/* Status checkboxes */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium text-slate-700 mr-1">Status:</span>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedStatuses.length === 0}
                onChange={() => setSelectedStatuses([])}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              All
            </label>
            {statuses.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(s.id)}
                  onChange={() => toggleStatus(s.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {s.name}
              </label>
            ))}
          </div>

          {/* Class + Poll + search row */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                name="selectedClass"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {polls.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
                <div className="flex gap-2 items-center">
                  <select
                    name="selectedPoll"
                    value={selectedPoll}
                    onChange={(e) => setSelectedPoll(e.target.value)}
                    className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All members</option>
                    {polls.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {selectedPoll && (
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={negatePoll}
                        onChange={(e) => setNegatePoll(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Negate poll
                    </label>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment method</label>
              <select
                name="selectedPaymentMethod"
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">- any -</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quick Find</label>
                <input
                  type="text"
                  name="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, address, postcode, no…"
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium">
                Search
              </button>
              {activeSearch && (
                <button type="button" onClick={handleCancelSearch}
                  className="border border-slate-300 rounded px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel Search
                </button>
              )}
            </form>

            {hasCfLabels && (
              <form onSubmit={handleCfSearch} className="flex gap-2 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom Fields</label>
                  <input
                    type="text"
                    name="customFieldSearch"
                    value={cfInput}
                    onChange={(e) => setCfInput(e.target.value)}
                    placeholder={cfLabelNames}
                    className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium">
                  Search
                </button>
                {activeCf && (
                  <button type="button" onClick={handleCancelCf}
                    className="border border-slate-300 rounded px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                    Clear
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        {/* ── Info text ────────────────────────────────────────────── */}
        <p className="text-sm text-slate-500 italic mb-3">
          Use Quick Find or select filters above to customise list of members. Perform operations on list at bottom of page.
        </p>

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
        {loading && <p className="text-center text-slate-500">Loading…</p>}

        {!loading && !error && (
          memberList.length === 0 ? (
            <p className="text-center text-slate-500 py-6">No members found.</p>
          ) : (
            <>
              {/* Select controls */}
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="text-sm text-slate-500">{memberList.length} member{memberList.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-medium text-slate-600">Select:</span>
                <button onClick={selectAll}    className="text-sm text-blue-700 hover:underline">All</button>
                <button onClick={clearAll}     className="text-sm text-blue-700 hover:underline">Clear All</button>
                <button onClick={selectEmail}  className="text-sm text-blue-700 hover:underline">Email only</button>
                <button onClick={selectNoEmail} className="text-sm text-blue-700 hover:underline">Without email</button>
                <button onClick={selectPortalPassword} className="text-sm text-blue-700 hover:underline">Portal password set</button>
                <button onClick={selectNoPortalPassword} className="text-sm text-blue-700 hover:underline">Without portal password</button>
                <button onClick={selectEmailNotConfirmed} className="text-sm text-blue-700 hover:underline">Email not confirmed</button>
                {selected.size > 0 && (
                  <span className="text-sm font-medium text-blue-700 ml-2">{selected.size} selected</span>
                )}
              </div>

              <div ref={tableRef} className="overflow-x-auto rounded-lg shadow-sm mb-3">
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className="px-2 py-2"></th>
                      <SortableHeader col="membership_number" label="No"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <th className="px-3 py-2 font-normal">
                        <span className="cursor-pointer select-none" onClick={() => onSort('forenames')}>
                          Name
                          <span className={`ml-1 text-xs ${sortKey === 'forenames' ? 'text-blue-600' : 'text-slate-300'}`}>
                            {sortKey === 'forenames' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        </span>
                        <span className="text-slate-300 mx-1">|</span>
                        <span
                          className="cursor-pointer select-none text-xs not-italic"
                          onClick={() => onSort(SORT_SURNAME)}
                        >
                          by surname
                          <span className={`ml-1 text-xs ${Array.isArray(sortKey) && sortKey[0] === 'surname' ? 'text-blue-600' : 'text-slate-300'}`}>
                            {Array.isArray(sortKey) && sortKey[0] === 'surname' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        </span>
                      </th>
                      <SortableHeader col="house_no"           label="Address"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="telephone"          label="Telephone"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="mobile"             label="Mobile"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="class"              label="Class"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="status"             label="Status"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((m, i) => (
                      <tr
                        key={m.id}
                        ref={(el) => { if (el) rowRefs.current[m.surname?.[0]?.toUpperCase()] = el; }}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} ${selected.has(m.id) ? 'outline outline-2 outline-blue-400' : ''}`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          {!m.email && <NoEmailIcon className="ml-1" />}
                        </td>
                        <td className={`px-3 py-2 tabular-nums ${isSubscriptionOverdue(m) ? 'text-red-600' : ''}`}>
                          {can('member_record', 'view') ? (
                            <a href="#view" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.id}`); }}
                              className={`hover:underline ${isSubscriptionOverdue(m) ? 'text-red-600' : 'text-blue-700'}`}>
                              {m.membership_number}
                            </a>
                          ) : m.membership_number}
                        </td>
                        <td className={`px-3 py-2 font-medium ${isSubscriptionOverdue(m) ? 'text-red-600' : ''}`}>
                          {can('member_record', 'view') ? (
                            <a href="#view" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.id}`); }}
                              className={`hover:underline ${isSubscriptionOverdue(m) ? 'text-red-600' : 'text-blue-700'}`}>
                              {formatMemberName(m)}
                            </a>
                          ) : formatMemberName(m)}
                        </td>
                        <td className="px-3 py-2">{formatShortAddress(m)}</td>
                        <td className="px-3 py-2">{m.telephone ?? ''}</td>
                        <td className="px-3 py-2">{m.mobile ?? ''}</td>
                        <td className="px-3 py-2">{m.class ?? ''}</td>
                        <td className="px-3 py-2">{m.status ?? ''}</td>
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}</label>
                      <select
                        name="bulkAction"
                        value={bulkAction}
                        onChange={(e) => { setBulkAction(e.target.value); setBulkResult(null); setDlError(null); }}
                        className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— choose action —</option>
                        {can('email', 'send') && <option value="send_email">Send email</option>}
                        {can('letters', 'view') && <option value="send_letter">Send letter</option>}
                        {hasBulkPolls && <option value="add_to_poll">Add to poll</option>}
                        {hasBulkGroups && <option value="add_to_group">Add to group</option>}
                        {hasBulkTeams && <option value="add_to_team">Add to team</option>}
                        <option value="download_excel">Download Excel</option>
                        <option value="download_pdf">Download PDF</option>
                        <option value="download_emails">Download email addresses</option>
                      </select>
                    </div>

                    {bulkAction === 'add_to_poll' && (
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

                    {bulkAction === 'add_to_group' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
                        <select
                          name="addToGroupId"
                          value={addToGroupId}
                          onChange={(e) => setAddToGroupId(e.target.value)}
                          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— select group —</option>
                          {allGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                    )}

                    {bulkAction === 'add_to_team' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
                        <select
                          name="addToTeamId"
                          value={addToTeamId}
                          onChange={(e) => setAddToTeamId(e.target.value)}
                          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— select team —</option>
                          {allTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    )}

                    {(bulkAction === 'send_email' || bulkAction === 'send_letter' || bulkAction === 'add_to_poll' || bulkAction === 'add_to_group' || bulkAction === 'add_to_team') && (
                      <button
                        onClick={handleBulkDo}
                        disabled={bulkWorking || (bulkAction === 'add_to_poll' && !addToPollId) || (bulkAction === 'add_to_group' && !addToGroupId) || (bulkAction === 'add_to_team' && !addToTeamId)}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                      >
                        {bulkWorking ? 'Working…' : 'Do with selected'}
                      </button>
                    )}

                    {bulkAction === 'download_emails' && (
                      <button onClick={() => handleDownload('email-csv')} disabled={downloading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                        {downloading ? 'Downloading…' : 'Download'}
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
                        {downloading ? 'Downloading…' : `Download ${bulkAction === 'download_excel' ? 'Excel' : 'PDF'}`}
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
