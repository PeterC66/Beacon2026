// beacon2/frontend/src/pages/membership/MembershipCards.jsx
// Membership Cards page (doc 4.7) — select members, download/email cards.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { membershipCards as cardsApi, polls as pollsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import NoEmailIcon from '../../components/NoEmailIcon.jsx';

export default function MembershipCards() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [memberList, setMemberList] = useState([]);
  const { sorted, sortKey, sortDir, onSort } = useSortedData(memberList);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tableRef = useRef(null);

  // Filters
  const [showMode, setShowMode] = useState('outstanding');
  const [selectedPoll, setSelectedPoll] = useState('');
  const [advanceYear, setAdvanceYear] = useState(false);

  // Selection + actions
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  // Mark-as-printed dialog
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [pendingMarkIds, setPendingMarkIds] = useState([]);

  // Load polls once
  useEffect(() => {
    pollsApi.list().then(setPolls).catch(() => {});
  }, []);

  // Load members when filters change
  useEffect(() => { load(); }, [showMode, selectedPoll]);

  async function load() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setActionResult(null);
    setActionError(null);
    try {
      const data = await cardsApi.list({ show: showMode, pollId: selectedPoll });
      setMemberList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Selection helpers
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAll()  { setSelected(new Set(sorted.map((m) => m.id))); }
  function clearAll()   { setSelected(new Set()); }

  // Action handlers
  async function handleDoAction() {
    if (selected.size === 0 && bulkAction !== 'print_blank') return;
    setWorking(true);
    setActionError(null);
    setActionResult(null);

    const ids = [...selected];

    try {
      if (bulkAction === 'download_cards') {
        await cardsApi.downloadCards(ids, advanceYear);
        setPendingMarkIds(ids);
        setShowMarkDialog(true);
      } else if (bulkAction === 'print_blank') {
        await cardsApi.downloadBlank(advanceYear);
      } else if (bulkAction === 'send_card_email') {
        // Store member IDs and navigate to email compose with card attachment flag
        sessionStorage.setItem('emailComposeMemberIds', JSON.stringify(ids));
        sessionStorage.setItem('emailComposeCardAttachment', JSON.stringify({
          advanceYear,
        }));
        navigate('/email/compose');
        return;
      } else if (bulkAction === 'download_excel') {
        await cardsApi.downloadExcel(ids, advanceYear);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleMarkPrinted() {
    try {
      await cardsApi.markPrinted(pendingMarkIds);
      setActionResult({ type: 'success', msg: `${pendingMarkIds.length} card${pendingMarkIds.length !== 1 ? 's' : ''} marked as printed.` });
      setShowMarkDialog(false);
      setPendingMarkIds([]);
      load(); // Refresh list
    } catch (err) {
      setActionError(err.message);
      setShowMarkDialog(false);
    }
  }

  function handleSkipMark() {
    setShowMarkDialog(false);
    setPendingMarkIds([]);
  }

  const navLinks = [
    { label: 'Home', to: '/' },
  ];

  const needsSelection = bulkAction !== 'print_blank';
  const canDoAction = bulkAction && (needsSelection ? selected.size > 0 : true);

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">Membership Cards</h1>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-3 space-y-3">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-slate-700">Show:</span>
            {[
              { value: 'outstanding', label: 'Outstanding only (new members and renewals)' },
              { value: 'poll',        label: 'Poll' },
              { value: 'outstanding_and_poll', label: 'Outstanding and poll' },
              { value: 'all',         label: 'All current members' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="showMode"
                  value={opt.value}
                  checked={showMode === opt.value}
                  onChange={(e) => setShowMode(e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                {opt.label}
                {/* Poll dropdown inline for poll-related modes */}
                {(opt.value === 'poll' || opt.value === 'outstanding_and_poll') &&
                  showMode === opt.value && polls.length > 0 && (
                  <select
                    name="selectedPoll"
                    value={selectedPoll}
                    onChange={(e) => setSelectedPoll(e.target.value)}
                    className="ml-2 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— select poll —</option>
                    {polls.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={advanceYear}
              onChange={(e) => setAdvanceYear(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Advance expiry to next membership year
          </label>
        </div>

        {/* ── Results ────────────────────────────────────────────── */}
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
                <button onClick={selectAll} className="text-sm text-blue-700 hover:underline">All</button>
                <button onClick={clearAll}  className="text-sm text-blue-700 hover:underline">Clear All</button>
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
                      <SortableHeader col="surname"           label="Surname"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="forenames"         label="Forenames" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="known_as"          label="Known as" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="town"              label="Town"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="postcode"          label="Postcode" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="email"             label="Email"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="status_name"       label="Status"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="class_name"        label="Class"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((m, i) => (
                      <tr
                        key={m.id}
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
                        <td className="px-3 py-2 tabular-nums">{m.membership_number}</td>
                        <td className="px-3 py-2 font-medium">
                          {can('member_record', 'view') ? (
                            <a href="#view" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.id}`); }}
                              className="text-blue-700 hover:underline">
                              {m.surname}
                            </a>
                          ) : m.surname}
                        </td>
                        <td className="px-3 py-2">{m.forenames}</td>
                        <td className="px-3 py-2 text-slate-500">{m.known_as ?? ''}</td>
                        <td className="px-3 py-2">{m.town ?? ''}</td>
                        <td className="px-3 py-2">{m.postcode ?? ''}</td>
                        <td className="px-3 py-2">{m.email ?? ''}</td>
                        <td className="px-3 py-2">{m.status_name ?? ''}</td>
                        <td className="px-3 py-2">{m.class_name ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Bulk actions ────────────────────────────────────── */}
              <div className="bg-white/90 rounded-lg shadow-sm p-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                    <select
                      name="bulkAction"
                      value={bulkAction}
                      onChange={(e) => { setBulkAction(e.target.value); setActionResult(null); setActionError(null); }}
                      className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— choose action —</option>
                      <option value="download_cards">Download cards</option>
                      <option value="print_blank">Print blank cards</option>
                      {can('email', 'send') && <option value="send_card_email">Send card by email</option>}
                      <option value="download_excel">Download Excel card data</option>
                    </select>
                  </div>

                  <button
                    onClick={handleDoAction}
                    disabled={working || !canDoAction}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                  >
                    {working ? 'Working…' : 'Do with selected'}
                  </button>

                  {actionResult && (
                    <p className={`text-sm font-medium ${actionResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                      {actionResult.msg}
                    </p>
                  )}
                  {actionError && <p className="text-sm text-red-600 font-medium">{actionError}</p>}
                </div>
              </div>
            </>
          )
        )}
      </div>

      <NavBar links={navLinks} />

      {/* ── Mark as printed dialog ──────────────────────────────── */}
      <ScrollButtons containerRef={tableRef} />

      {showMarkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Confirm</h2>
            <p className="text-sm text-slate-600 mb-4">Mark selected cards as printed?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleSkipMark}
                className="border border-slate-300 rounded px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Skip
              </button>
              <button
                onClick={handleMarkPrinted}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium"
              >
                Mark
              </button>
            </div>
          </div>
        </div>
      )}
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
