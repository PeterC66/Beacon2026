// beacon2026/frontend/src/pages/finance/FinanceLedger.jsx
// Financial ledger — view transactions by account, category, or group.
// Implements Beacon doc 7.1.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  finance as financeApi,
  groups as groupsApi,
  teams as teamsApi,
  calendar as calendarApi,
} from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { VIEWS, thisYear, fmtAmount, isEligible } from './financeLedgerUtils.js';
import FinanceLedgerControls from './FinanceLedgerControls.jsx';
import FinanceLedgerTable from './FinanceLedgerTable.jsx';

export default function FinanceLedger() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initView = VIEWS.includes(searchParams.get('view')) ? searchParams.get('view') : 'account';
  const initEventId = initView === 'event' ? searchParams.get('eventId') || '' : '';
  const initGroupId = initView === 'group' ? searchParams.get('groupId') || '' : '';

  const [view, setView] = useState(initView);
  const [year, setYear] = useState(thisYear);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selId, setSelId] = useState(initEventId || initGroupId);
  const [groupFilter, setGroupFilter] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState([]);
  const [eventLabel, setEventLabel] = useState('');
  const [txns, setTxns] = useState([]);
  const [openingBal, setOpeningBal] = useState(0);
  const [groupBf, setGroupBf] = useState([]); // per-group B/F rows
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bulk action state
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const tableRef = useRef(null);

  // Enrich transactions with a derived category_list string for sorting
  const enrichedTxns = useMemo(
    () =>
      txns.map((t) => ({
        ...t,
        category_list: Array.isArray(t.categories)
          ? t.categories
              .map((c) => c.name)
              .filter(Boolean)
              .join(', ')
          : '',
      })),
    [txns],
  );

  const { sorted, sortKey, sortDir, onSort } = useSortedData(enrichedTxns, 'date', 'asc');

  // Load selector lists
  useEffect(() => {
    async function loadLists() {
      try {
        const [acc, cat, grp, tm] = await Promise.all([
          financeApi.listAccounts(),
          financeApi.listCategories(),
          groupsApi.list({ activeOnly: false }),
          teamsApi.list({ activeOnly: false }),
        ]);
        setAccounts(acc.filter((a) => a.active));
        setCategories(cat.filter((c) => c.active));
        setGroups([...grp, ...tm]);
      } catch (err) {
        setError(err.message);
      }
    }
    loadLists();
  }, []);

  // Reset selection when the user changes view. Skipped on initial mount
  // so that a pre-selected eventId/groupId from the URL survives.
  const skipViewReset = useRef(true);
  useEffect(() => {
    if (skipViewReset.current) {
      skipViewReset.current = false;
      return;
    }
    setSelId('');
    setTxns([]);
    setOpeningBal(0);
    setGroupBf([]);
    setGroupFilter('');
    setEventSearch('');
    setEventResults([]);
    setEventLabel('');
    setSelected(new Set());
  }, [view]);

  // When arriving with a pre-selected event ID, fetch its label
  useEffect(() => {
    if (!initEventId) return;
    calendarApi
      .getEvent(initEventId)
      .then((ev) => {
        const lbl = ev.topic || ev.group_name || ev.event_type_name || 'Event';
        const d = ev.event_date ? String(ev.event_date).slice(0, 10) : '';
        setEventLabel(`${lbl}${d ? ` — ${d}` : ''}`);
      })
      .catch(() => setEventLabel('Selected event'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Event search-as-you-type (matches TransactionEditor pattern)
  useEffect(() => {
    if (view !== 'event' || eventSearch.length < 2) {
      setEventResults([]);
      return;
    }
    const timer = setTimeout(() => {
      calendarApi
        .searchEvents(eventSearch)
        .then(setEventResults)
        .catch(() => setEventResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [eventSearch, view]);

  const filteredGroups = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.short_name && g.short_name.toLowerCase().includes(q)),
    );
  }, [groups, groupFilter]);

  // Fetch transactions when selId or year changes
  const loadTransactions = useCallback(async () => {
    if (!selId) {
      setTxns([]);
      return;
    }
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const params = {};
      if (view !== 'event') params.year = year;
      if (view === 'account') params.accountId = selId;
      if (view === 'category') params.categoryId = selId;
      if (view === 'group') params.groupId = selId;
      if (view === 'event') params.eventId = selId;
      const result = await financeApi.listTransactions(params);
      // Account view returns { transactions, openingBalance };
      // Group view may return { transactions, groupBf }; others return array
      if (result && !Array.isArray(result) && result.transactions) {
        setTxns(result.transactions);
        setOpeningBal(result.openingBalance ?? 0);
        setGroupBf(result.groupBf ?? []);
      } else {
        setTxns(result);
        setOpeningBal(0);
        setGroupBf([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selId, year, view]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Running balance — computed for all views.
  // Account view uses the opening balance; other views start from 0.
  // Pending transactions are excluded from the running balance.
  const withBalance = useMemo(() => {
    let balance = view === 'account' ? openingBal : 0;
    return sorted.map((t) => {
      if (!t.pending) {
        const amt = Number(view === 'category' ? (t.category_amount ?? t.amount) : t.amount);
        if (t.type === 'in') balance += amt;
        if (t.type === 'out') balance -= amt;
      }
      return { ...t, _balance: t.pending ? null : balance };
    });
  }, [sorted, view, openingBal]);

  // Totals — in category view use the split category_amount, not the full transaction amount
  const totals = useMemo(() => {
    const amt = (t) =>
      view === 'category' ? Number(t.category_amount ?? t.amount) : Number(t.amount);
    const inTotal = txns.filter((t) => t.type === 'in').reduce((s, t) => s + amt(t), 0);
    const outTotal = txns.filter((t) => t.type === 'out').reduce((s, t) => s + amt(t), 0);
    return { in: inTotal, out: outTotal };
  }, [txns, view]);

  const eligibleIds = useMemo(() => {
    return new Set(txns.filter(isEligible).map((t) => t.id));
  }, [txns]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === eligibleIds.size) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleIds));
    }
  };

  async function handleBulkAction() {
    if (!bulkAction || selected.size === 0) return;
    const ids = [...selected];
    setBulkBusy(true);
    setError(null);
    try {
      if (bulkAction === 'confirm') {
        await financeApi.bulkPending(ids, false);
      } else if (bulkAction === 'make-pending') {
        await financeApi.bulkPending(ids, true);
      }
      await loadTransactions();
      setBulkAction('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkBusy(false);
    }
  }

  const showBulk = view === 'account' && can('finance_transactions', 'change');

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('finance_transactions', 'create')
      ? [{ label: 'Add transaction', to: '/finance/transactions/new' }]
      : []),
    ...(can('finance_batches', 'view')
      ? [{ label: 'Credit batches', to: '/finance/batches' }]
      : []),
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-[100rem] mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Financial Ledger</h1>

        {/* Controls */}
        <FinanceLedgerControls
          view={view}
          setView={setView}
          setSearchParams={setSearchParams}
          year={year}
          setYear={setYear}
          accounts={accounts}
          categories={categories}
          filteredGroups={filteredGroups}
          selId={selId}
          setSelId={setSelId}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          eventSearch={eventSearch}
          setEventSearch={setEventSearch}
          eventResults={eventResults}
          setEventResults={setEventResults}
          eventLabel={eventLabel}
          setEventLabel={setEventLabel}
        />

        {loading && <p className="text-center text-slate-500 py-8">Loading…</p>}
        {error && <p className="text-center text-red-600 py-4">Error: {error}</p>}

        {!loading && selId && !error && (
          <>
            {txns.length === 0 && view === 'event' ? (
              <p className="text-center text-slate-400 py-8">
                No transactions linked to this event.
              </p>
            ) : txns.length === 0 && view !== 'account' ? (
              <p className="text-center text-slate-400 py-8">
                No transactions found for this {view} in {year}.
              </p>
            ) : txns.length === 0 && view === 'account' ? (
              <p className="text-center text-slate-400 py-8">
                No transactions found for this {view} in {year}. Opening balance:{' '}
                {fmtAmount(openingBal)}
              </p>
            ) : (
              <>
                <FinanceLedgerTable
                  view={view}
                  showBulk={showBulk}
                  eligibleIds={eligibleIds}
                  selected={selected}
                  toggleAll={toggleAll}
                  toggleSelect={toggleSelect}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  withBalance={withBalance}
                  openingBal={openingBal}
                  groupBf={groupBf}
                  totals={totals}
                  tableRef={tableRef}
                  can={can}
                  navigate={navigate}
                />

                {/* Bulk actions bar — below the table per standard */}
                {showBulk && eligibleIds.size > 0 && (
                  <div className="bg-white/90 rounded-lg shadow-sm p-3 mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-600">{selected.size} selected</span>
                    <select
                      name="bulkAction"
                      value={bulkAction}
                      onChange={(e) => setBulkAction(e.target.value)}
                      className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— action —</option>
                      <option value="confirm">Confirm (not pending)</option>
                      <option value="make-pending">Make pending</option>
                    </select>
                    <button
                      onClick={handleBulkAction}
                      disabled={!bulkAction || selected.size === 0 || bulkBusy}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                    >
                      {bulkBusy ? 'Updating…' : 'Do with selected'}
                    </button>
                  </div>
                )}

                <div className="mt-4 flex justify-center gap-3">
                  {can('finance_transactions', 'create') && (
                    <button
                      onClick={() =>
                        navigate(
                          `/finance/transactions/new${selId && view === 'account' ? `?accountId=${selId}` : ''}`,
                        )
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
                    >
                      Add transaction
                    </button>
                  )}
                  {can('finance_batches', 'create') && view === 'account' && selId && (
                    <button
                      onClick={() => navigate(`/finance/batches?account=${selId}&mode=create`)}
                      className="border border-indigo-400 text-indigo-700 hover:bg-indigo-50 rounded px-5 py-2 text-sm font-medium transition-colors"
                    >
                      Add batch
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {!loading && !selId && !error && (
          <p className="text-center text-slate-400 py-12">
            Select a {view} above to view transactions.
          </p>
        )}
      </div>

      <NavBar links={navLinks} />
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
