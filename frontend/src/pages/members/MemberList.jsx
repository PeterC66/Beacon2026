// beacon2026/frontend/src/pages/members/MemberList.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  members as membersApi,
  memberStatuses as statusApi,
  memberClasses as classApi,
  polls as pollsApi,
  groups as groupsApi,
  teams as teamsApi,
  settings as settingsApi,
} from '../../lib/api.js';
import {
  SS_EMAIL_COMPOSE_MEMBER_IDS,
  SS_LETTER_COMPOSE_MEMBER_IDS,
} from '../../lib/storageKeys.js';
import { ROUTES } from '../../lib/routes.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { useLetterJump } from '../../hooks/useLetterJump.js';
import { DOWNLOAD_FIELDS, ALPHABET } from './memberListConstants.js';
import MemberListFilters from './MemberListFilters.jsx';
import MemberListTable from './MemberListTable.jsx';
import MemberListBulkActions from './MemberListBulkActions.jsx';

export default function MemberList() {
  const { can, tenant, hasFeature } = useAuth();
  const navigate = useNavigate();

  const [memberList, setMemberList] = useState([]);
  const SORT_SURNAME = ['surname', 'forenames'];
  const { sorted, sortKey, sortDir, onSort } = useSortedData(memberList, SORT_SURNAME, 'asc');
  const [statuses, setStatuses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedPoll, setSelectedPoll] = useState('');
  const [negatePoll, setNegatePoll] = useState(false);
  const [letter, setLetter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [cfInput, setCfInput] = useState('');
  const [activeCf, setActiveCf] = useState('');
  const [cfLabels, setCfLabels] = useState({ label1: '', label2: '', label3: '', label4: '' });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  // Selection + bulk actions
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [addToPollId, setAddToPollId] = useState('');
  const [addToGroupId, setAddToGroupId] = useState('');
  const [allGroups, setAllGroups] = useState([]);
  const [addToTeamId, setAddToTeamId] = useState('');
  const [allTeams, setAllTeams] = useState([]);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Downloads
  const [dlFields, setDlFields] = useState(
    new Set(DOWNLOAD_FIELDS.filter((f) => f.default).map((f) => f.key)),
  );
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState(null);

  const tableRef = useRef(null);
  const azJump = hasFeature('azButtonsJumpToRecord');
  const { rowRef, jumpToLetter, highlightId } = useLetterJump();

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
    settingsApi
      .getCustomFieldLabels()
      .then(setCfLabels)
      .catch(() => {});
    groupsApi
      .list({ activeOnly: true })
      .then(setAllGroups)
      .catch(() => {});
    teamsApi
      .list({ activeOnly: true })
      .then(setAllTeams)
      .catch(() => {});
  }, []);

  // Load members whenever filters change
  useEffect(() => {
    load();
  }, [
    selectedStatuses,
    selectedClass,
    selectedPoll,
    negatePoll,
    letter,
    activeSearch,
    activeCf,
    selectedPaymentMethod,
  ]);

  async function load() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setBulkResult(null);
    try {
      const data = await membersApi.list({
        status: selectedStatuses.join(','),
        classId: selectedClass,
        pollId: selectedPoll,
        negatePoll: negatePoll && selectedPoll ? true : false,
        letter,
        q: activeSearch,
        cf: activeCf,
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
    if (azJump) {
      jumpToLetter(sorted, 'surname', l);
      return;
    }
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

  function selectAll() {
    setSelected(new Set(sorted.map((m) => m.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }
  function selectEmail() {
    setSelected(new Set(sorted.filter((m) => m.email).map((m) => m.id)));
  }
  function selectNoEmail() {
    setSelected(new Set(sorted.filter((m) => !m.email).map((m) => m.id)));
  }
  function selectPortalPassword() {
    setSelected(new Set(sorted.filter((m) => m.has_portal_password).map((m) => m.id)));
  }
  function selectNoPortalPassword() {
    setSelected(new Set(sorted.filter((m) => !m.has_portal_password).map((m) => m.id)));
  }
  function selectEmailNotConfirmed() {
    setSelected(
      new Set(
        sorted.filter((m) => m.has_portal_password && !m.portal_email_verified).map((m) => m.id),
      ),
    );
  }

  async function handleBulkDo() {
    if (selected.size === 0) return;
    if (bulkAction === 'send_email') {
      sessionStorage.setItem(SS_EMAIL_COMPOSE_MEMBER_IDS, JSON.stringify([...selected]));
      navigate(ROUTES.EMAIL_COMPOSE);
      return;
    }
    if (bulkAction === 'send_letter') {
      sessionStorage.setItem(SS_LETTER_COMPOSE_MEMBER_IDS, JSON.stringify([...selected]));
      navigate(ROUTES.LETTERS_COMPOSE);
      return;
    }
    if (bulkAction === 'add_to_poll') {
      if (!addToPollId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await pollsApi.addMembers(addToPollId, [...selected]);
        const pollName = polls.find((p) => p.id === addToPollId)?.name ?? 'poll';
        setBulkResult({
          type: 'success',
          msg: `${result.added} member${result.added !== 1 ? 's' : ''} added to "${pollName}".`,
        });
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
        if (result.added) parts.push(`${result.added} added`);
        if (result.waitlisted) parts.push(`${result.waitlisted} waitlisted`);
        if (result.skipped) parts.push(`${result.skipped} already in group`);
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
        if (result.added) parts.push(`${result.added} added`);
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDownload(format) {
    const ids = selected.size > 0 ? [...selected] : sorted.map((m) => m.id);
    const fields =
      format === 'email-csv'
        ? []
        : DOWNLOAD_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
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
    .filter(Boolean)
    .join(', ');

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('member_record', 'create') ? [{ label: 'Add New Member', to: '/members/new' }] : []),
  ];

  const hasBulkPolls = can('poll_set_up', 'change') && polls.length > 0;
  const hasBulkGroups = can('group_records_all', 'change') && allGroups.length > 0;
  const hasBulkTeams = can('group_records_all', 'change') && allTeams.length > 0;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">Members</h1>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <MemberListFilters
          statuses={statuses}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          toggleStatus={toggleStatus}
          classes={classes}
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
          polls={polls}
          selectedPoll={selectedPoll}
          setSelectedPoll={setSelectedPoll}
          negatePoll={negatePoll}
          setNegatePoll={setNegatePoll}
          selectedPaymentMethod={selectedPaymentMethod}
          setSelectedPaymentMethod={setSelectedPaymentMethod}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          activeSearch={activeSearch}
          handleSearch={handleSearch}
          handleCancelSearch={handleCancelSearch}
          hasCfLabels={hasCfLabels}
          cfLabelNames={cfLabelNames}
          cfInput={cfInput}
          setCfInput={setCfInput}
          activeCf={activeCf}
          handleCfSearch={handleCfSearch}
          handleCancelCf={handleCancelCf}
        />

        {/* ── Info text ────────────────────────────────────────────── */}
        <p className="text-sm text-slate-500 italic mb-3">
          Use Quick Find or select filters above to customise list of members. Perform operations on
          list at bottom of page.
        </p>

        {/* ── Letter navigation ─────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 mb-3">
          {!azJump && (
            <button
              onClick={() => handleLetterClick('')}
              className={`px-2 py-0.5 text-sm rounded border ${letter === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              All
            </button>
          )}
          {ALPHABET.map((l) => (
            <button
              key={l}
              onClick={() => handleLetterClick(l)}
              title={azJump ? `Jump to first surname starting ${l}` : undefined}
              className={`px-2 py-0.5 text-sm rounded border ${letter === l && !azJump ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── Results ───────────────────────────────────────────────── */}
        {error && <p className="text-center text-red-600 mb-3">Error: {error}</p>}
        {loading && <p className="text-center text-slate-500">Loading…</p>}

        {!loading &&
          !error &&
          (memberList.length === 0 ? (
            <p className="text-center text-slate-500 py-6">No members found.</p>
          ) : (
            <>
              <MemberListTable
                memberList={memberList}
                sorted={sorted}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                sortSurname={SORT_SURNAME}
                selected={selected}
                toggleSelect={toggleSelect}
                selectAll={selectAll}
                clearAll={clearAll}
                selectEmail={selectEmail}
                selectNoEmail={selectNoEmail}
                selectPortalPassword={selectPortalPassword}
                selectNoPortalPassword={selectNoPortalPassword}
                selectEmailNotConfirmed={selectEmailNotConfirmed}
                rowRef={rowRef}
                highlightId={highlightId}
                tableRef={tableRef}
                can={can}
                navigate={navigate}
              />

              {/* ── Bulk actions ──────────────────────────────────────── */}
              {selected.size > 0 && (
                <MemberListBulkActions
                  selected={selected}
                  bulkAction={bulkAction}
                  setBulkAction={setBulkAction}
                  setBulkResult={setBulkResult}
                  setDlError={setDlError}
                  can={can}
                  hasFeature={hasFeature}
                  hasBulkPolls={hasBulkPolls}
                  hasBulkGroups={hasBulkGroups}
                  hasBulkTeams={hasBulkTeams}
                  polls={polls}
                  addToPollId={addToPollId}
                  setAddToPollId={setAddToPollId}
                  allGroups={allGroups}
                  addToGroupId={addToGroupId}
                  setAddToGroupId={setAddToGroupId}
                  allTeams={allTeams}
                  addToTeamId={addToTeamId}
                  setAddToTeamId={setAddToTeamId}
                  handleBulkDo={handleBulkDo}
                  bulkWorking={bulkWorking}
                  bulkResult={bulkResult}
                  handleDownload={handleDownload}
                  downloading={downloading}
                  dlError={dlError}
                  dlFields={dlFields}
                  toggleDlField={toggleDlField}
                />
              )}
            </>
          ))}
      </div>

      <NavBar links={navLinks} />
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
