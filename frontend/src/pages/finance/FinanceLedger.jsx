// beacon2/frontend/src/pages/finance/FinanceLedger.jsx
// Financial ledger — view transactions by account, category, or group.
// Implements Beacon doc 7.1.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { finance as financeApi, groups as groupsApi, teams as teamsApi, calendar as calendarApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const VIEWS = ['account', 'category', 'group', 'event'];
const VIEW_LABELS = { account: 'Account', category: 'Category', group: 'Group/Team', event: 'Event' };
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => thisYear - i);

const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
const fmtAmount = (n) => n != null ? `£${Number(n).toFixed(2)}` : '';

export default function FinanceLedger() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initView = VIEWS.includes(searchParams.get('view')) ? searchParams.get('view') : 'account';
  const [view,       setView]       = useState(initView);
  const [year,       setYear]       = useState(thisYear);
  const [accounts,   setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [groups,     setGroups]     = useState([]);
  const [selId,       setSelId]       = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [eventSearch,  setEventSearch]  = useState('');
  const [eventResults, setEventResults] = useState([]);
  const [eventLabel,   setEventLabel]   = useState('');
  const [txns,        setTxns]        = useState([]);
  const [openingBal,  setOpeningBal]  = useState(0);
  const [groupBf,     setGroupBf]     = useState([]);   // per-group B/F rows
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  // Bulk action state
  const [selected,   setSelected]   = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkBusy,   setBulkBusy]   = useState(false);

  const tableRef = useRef(null);

  // Enrich transactions with a derived category_list string for sorting
  const enrichedTxns = useMemo(() => txns.map((t) => ({
    ...t,
    category_list: Array.isArray(t.categories) ? t.categories.map((c) => c.name).filter(Boolean).join(', ') : '',
  })), [txns]);

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
      } catch (err) { setError(err.message); }
    }
    loadLists();
  }, []);

  // Reset selection when view changes
  useEffect(() => {
    setSelId(''); setTxns([]); setOpeningBal(0); setGroupBf([]);
    setGroupFilter(''); setEventSearch(''); setEventResults([]); setEventLabel('');
    setSelected(new Set());
  }, [view]);

  // Event search-as-you-type (matches TransactionEditor pattern)
  useEffect(() => {
    if (view !== 'event' || eventSearch.length < 2) { setEventResults([]); return; }
    const timer = setTimeout(() => {
      calendarApi.searchEvents(eventSearch).then(setEventResults).catch(() => setEventResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [eventSearch, view]);

  const filteredGroups = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || (g.short_name && g.short_name.toLowerCase().includes(q)));
  }, [groups, groupFilter]);

  // Fetch transactions when selId or year changes
  const loadTransactions = useCallback(async () => {
    if (!selId) { setTxns([]); return; }
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const params = {};
      if (view !== 'event') params.year = year;
      if (view === 'account')  params.accountId  = selId;
      if (view === 'category') params.categoryId = selId;
      if (view === 'group')    params.groupId    = selId;
      if (view === 'event')    params.eventId    = selId;
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
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [selId, year, view]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Running balance — computed for all views.
  // Account view uses the opening balance; other views start from 0.
  // Pending transactions are excluded from the running balance.
  const withBalance = useMemo(() => {
    let balance = view === 'account' ? openingBal : 0;
    return sorted.map((t) => {
      if (!t.pending) {
        const amt = Number(view === 'category' ? (t.category_amount ?? t.amount) : t.amount);
        if (t.type === 'in')  balance += amt;
        if (t.type === 'out') balance -= amt;
      }
      return { ...t, _balance: t.pending ? null : balance };
    });
  }, [sorted, view, openingBal]);

  // Totals — in category view use the split category_amount, not the full transaction amount
  const totals = useMemo(() => {
    const amt = (t) => view === 'category' ? Number(t.category_amount ?? t.amount) : Number(t.amount);
    const inTotal  = txns.filter((t) => t.type === 'in').reduce((s, t) => s + amt(t), 0);
    const outTotal = txns.filter((t) => t.type === 'out').reduce((s, t) => s + amt(t), 0);
    return { in: inTotal, out: outTotal };
  }, [txns, view]);

  // Bulk action eligibility: not cleared, not in a batch, not a transfer, in the current year
  const isEligible = (t) => !t.cleared_at && !t.batch_id && !t.transfer_id;

  const eligibleIds = useMemo(() => {
    return new Set(txns.filter(isEligible).map((t) => t.id));
  }, [txns]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    } catch (err) { setError(err.message); }
    finally { setBulkBusy(false); }
  }

  const showBulk = view === 'account' && can('finance_transactions', 'change');

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('finance_transactions', 'create') ? [{ label: 'Add transaction', to: '/finance/transactions/new' }] : []),
    ...(can('finance_batches', 'view') ? [{ label: 'Credit batches', to: '/finance/batches' }] : []),
  ];

  const TH = 'px-3 py-2.5 font-normal';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-[100rem] mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Financial Ledger</h1>

        {/* Controls */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-4 items-end">
          {/* View selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">View by</label>
            <div className="flex gap-1">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); setSearchParams({ view: v }); }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    view === v ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">{VIEW_LABELS[view]}</label>
            {view === 'group' && (
              <input
                type="text"
                name="groupFilter"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                placeholder="Filter groups & teams…"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
              />
            )}
            {view === 'event' ? (
              selId ? (
                <div className="flex items-center gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50">
                  <span className="flex-1 text-slate-700">{eventLabel || 'Selected event'}</span>
                  <button
                    type="button"
                    onClick={() => { setSelId(''); setEventLabel(''); setEventSearch(''); setEventResults([]); }}
                    className="text-red-600 hover:underline text-xs"
                  >Clear</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    name="eventSearch"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search by topic, group name, or date…"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {eventResults.length > 0 && (
                    <ul className="border border-slate-200 rounded max-h-40 overflow-y-auto text-sm bg-white mt-1">
                      {eventResults.map((ev) => {
                        const lbl = ev.topic || ev.group_name || ev.event_type_name || 'Event';
                        const d = ev.event_date ? String(ev.event_date).slice(0, 10) : '';
                        return (
                          <li key={ev.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelId(ev.id);
                                setEventLabel(`${lbl}${d ? ` — ${d}` : ''}`);
                                setEventSearch('');
                                setEventResults([]);
                              }}
                              className="block w-full text-left px-2 py-1 hover:bg-blue-50"
                            >
                              {lbl}{d ? ` — ${d}` : ''}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )
            ) : (
              <select
                name="selId"
                value={selId}
                onChange={(e) => setSelId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— select —</option>
                {view === 'account'  && accounts.map((a)  => <option key={a.id}  value={a.id}>{a.name}</option>)}
                {view === 'category' && categories.map((c) => <option key={c.id}  value={c.id}>{c.name}</option>)}
                {view === 'group'    && (
                  <>
                    <option value="all">All groups &amp; teams</option>
                    {filteredGroups.map((g) => (
                      <option key={g.id} value={g.id} style={g.status === 'inactive' ? { color: '#dc2626' } : {}}>
                        {g.short_name || g.name}{g.status === 'inactive' ? ' (inactive)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            )}
          </div>

          {/* Year — not used in event view (all transactions for the event are shown) */}
          {view !== 'event' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <select
                name="year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>

        {loading && <p className="text-center text-slate-500 py-8">Loading…</p>}
        {error   && <p className="text-center text-red-600 py-4">Error: {error}</p>}

        {!loading && selId && !error && (
          <>
            {txns.length === 0 && view === 'event' ? (
              <p className="text-center text-slate-400 py-8">No transactions linked to this event.</p>
            ) : txns.length === 0 && view !== 'account' ? (
              <p className="text-center text-slate-400 py-8">No transactions found for this {view} in {year}.</p>
            ) : txns.length === 0 && view === 'account' ? (
              <p className="text-center text-slate-400 py-8">No transactions found for this {view} in {year}. Opening balance: {fmtAmount(openingBal)}</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg shadow-sm" ref={tableRef}>
                  <table className="w-full text-sm bg-white min-w-max">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                        {showBulk && (
                          <th className="px-2 py-2.5 w-8">
                            <input
                              type="checkbox"
                              checked={eligibleIds.size > 0 && selected.size === eligibleIds.size}
                              onChange={toggleAll}
                              className="h-4 w-4 rounded border-slate-300"
                              title="Select all eligible"
                            />
                          </th>
                        )}
                        <SortableHeader col="account_name"       label="Account"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="transaction_number" label="#"            sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="date"               label="Date"         sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="batch_no"           label="Batch No"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="batch_description"  label="Batch Ref"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="from_to"            label="From/To"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="group_name"         label="Group/Team"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="member_1_no"        label="Mem#"         sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <th className={TH}>Mem2#</th>
                        <SortableHeader col="detail"             label="Detail"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="category_list"      label="Category"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="payment_ref"        label="Payment Ref"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <SortableHeader col="payment_method"     label="Method"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                        <th className={`${TH} text-right`}>In</th>
                        <th className={`${TH} text-right`}>Out</th>
                        <th className={`${TH} text-center`}>Refund</th>
                        <th className={`${TH} text-right`}>Balance</th>
                        <th className={`${TH} text-center`}>Cleared</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view === 'account' && (
                        <tr className="bg-slate-100 border-b border-slate-200 italic text-slate-600">
                          {showBulk && <td className="px-2 py-2"></td>}
                          <td className="px-3 py-2" colSpan={4}></td>
                          <td className="px-3 py-2" colSpan={9}>Balance brought forward</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtAmount(openingBal)}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      )}
                      {view === 'group' && groupBf.length > 0 && groupBf.map((bf) => (
                        <tr key={`bf-${bf.group_id}`} className="bg-slate-100 border-b border-slate-200 italic text-slate-600">
                          <td className="px-3 py-2" colSpan={4}></td>
                          <td className="px-3 py-2" colSpan={9}>
                            Balance b/f{bf.group_name ? ` — ${bf.group_short_name || bf.group_name}` : ''}
                          </td>
                          <td className="px-3 py-2 text-right text-green-700">{bf.balance >= 0 ? fmtAmount(bf.balance) : ''}</td>
                          <td className="px-3 py-2 text-right text-red-700">{bf.balance < 0 ? fmtAmount(Math.abs(bf.balance)) : ''}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      ))}
                      {view === 'group' && groupBf.length > 0 && (() => {
                        const totalBf = groupBf.reduce((s, bf) => s + bf.balance, 0);
                        return (
                          <tr className="bg-slate-200 border-b border-slate-300 font-bold text-slate-700">
                            <td className="px-3 py-2" colSpan={4}></td>
                            <td className="px-3 py-2" colSpan={9}>Total Brought Forward</td>
                            <td className="px-3 py-2 text-right text-green-700">{totalBf >= 0 ? fmtAmount(totalBf) : ''}</td>
                            <td className="px-3 py-2 text-right text-red-700">{totalBf < 0 ? fmtAmount(Math.abs(totalBf)) : ''}</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        );
                      })()}
                      {withBalance.map((t, i) => (
                        <tr key={t.id} className={`border-b border-slate-100 ${t.refund_of_id ? 'bg-red-50 text-red-700' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                          {showBulk && (
                            <td className="px-2 py-2">
                              {isEligible(t) && (
                                <input
                                  type="checkbox"
                                  checked={selected.has(t.id)}
                                  onChange={() => toggleSelect(t.id)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              )}
                            </td>
                          )}
                          {/* Account */}
                          <td className="px-3 py-2 whitespace-nowrap">{t.account_name ?? ''}</td>
                          {/* # */}
                          <td className="px-3 py-2">
                            {can('finance_transactions', 'view') ? (
                              <button
                                onClick={() => navigate(`/finance/transactions/${t.id}`)}
                                className="text-blue-700 hover:underline font-mono"
                              >
                                {t.transaction_number}
                              </button>
                            ) : (
                              <span className="font-mono">{t.transaction_number}</span>
                            )}
                          </td>
                          {/* Date */}
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                          {/* Batch No */}
                          <td className="px-3 py-2">
                            {t.batch_no && can('finance_batches', 'view') ? (
                              <button
                                onClick={() => navigate(`/finance/batches?batchId=${t.batch_id}`)}
                                className="text-blue-700 hover:underline"
                              >
                                {t.batch_no}
                              </button>
                            ) : (
                              t.batch_no ?? ''
                            )}
                          </td>
                          {/* Batch Ref */}
                          <td className="px-3 py-2 max-w-[120px] truncate" title={t.batch_description ?? ''}>{t.batch_description ?? ''}</td>
                          {/* From/To */}
                          <td className="px-3 py-2 max-w-[140px] truncate" title={t.from_to}>{t.from_to}</td>
                          {/* Group / Event */}
                          <td className="px-3 py-2 max-w-[120px] truncate" title={t.group_name ?? ''}>
                            {t.group_name && t.group_id ? (
                              <Link to={`/${t.group_type === 'team' ? 'teams' : 'groups'}/${t.group_id}`} className="text-blue-700 hover:underline">{t.group_short_name || t.group_name}</Link>
                            ) : (
                              t.group_short_name || t.group_name || ''
                            )}
                            {t.event_id && (
                              <div className="text-xs">
                                <Link to={`/calendar/events/${t.event_id}`} className="text-blue-600 hover:underline">
                                  {t.event_label || t.event_topic || 'Event'}
                                </Link>
                              </div>
                            )}
                          </td>
                          {/* Mem# */}
                          <td className="px-3 py-2">
                            {t.member_1_no && t.member_id_1 ? (
                              <Link to={`/members/${t.member_id_1}`} className="text-blue-700 hover:underline font-mono" title={t.member_1_name}>{t.member_1_no}</Link>
                            ) : (
                              ''
                            )}
                          </td>
                          {/* Mem2# */}
                          <td className="px-3 py-2">
                            {t.member_2_no && t.member_id_2 ? (
                              <Link to={`/members/${t.member_id_2}`} className="text-blue-700 hover:underline font-mono" title={t.member_2_name}>{t.member_2_no}</Link>
                            ) : (
                              ''
                            )}
                          </td>
                          {/* Detail */}
                          <td className="px-3 py-2 max-w-[180px] truncate" title={t.detail}>{t.detail}</td>
                          {/* Category */}
                          <td className="px-3 py-2 max-w-[140px] truncate" title={t.category_list}>{t.category_list}</td>
                          {/* Payment Ref */}
                          <td className="px-3 py-2">{t.payment_ref ?? ''}</td>
                          {/* Method */}
                          <td className="px-3 py-2">{t.payment_method}</td>
                          {/* In */}
                          <td className="px-3 py-2 text-right text-green-700">{t.type === 'in'  ? fmtAmount(view === 'category' ? t.category_amount : t.amount) : ''}</td>
                          {/* Out */}
                          <td className="px-3 py-2 text-right text-red-700"> {t.type === 'out' ? fmtAmount(view === 'category' ? t.category_amount : t.amount) : ''}</td>
                          {/* Refund */}
                          <td className="px-3 py-2 text-center text-xs">
                            {t.refund_of_txn_number && (
                              <button
                                onClick={() => navigate(`/finance/transactions/${t.refund_of_id}`)}
                                className="text-red-600 hover:underline font-mono"
                              >{t.refund_of_txn_number}</button>
                            )}
                            {t.refunded_by_txn_number && (
                              <button
                                onClick={() => navigate(`/finance/transactions/${t.refunded_by_id}`)}
                                className="text-blue-600 hover:underline font-mono"
                              >{t.refunded_by_txn_number}</button>
                            )}
                          </td>
                          {/* Balance */}
                          <td className={`px-3 py-2 text-right font-medium ${
                            t.pending ? 'text-slate-400 italic' : (t._balance >= 0 ? 'text-slate-700' : 'text-red-600')
                          }`}>
                            {t.pending ? '' : fmtAmount(t._balance)}
                          </td>
                          {/* Cleared */}
                          <td className="px-3 py-2 text-center text-xs text-slate-500">
                            {t.pending
                              ? <span className="text-amber-600 font-medium">Pending</span>
                              : t.cleared_at ? fmtDate(t.cleared_at) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-medium text-sm">
                        {showBulk && <td></td>}
                        <td colSpan={13} className="px-3 py-2 text-right text-slate-600">Totals:</td>
                        <td className="px-3 py-2 text-right text-green-700">{fmtAmount(totals.in)}</td>
                        <td className="px-3 py-2 text-right text-red-700">{fmtAmount(totals.out)}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

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
                      onClick={() => navigate(`/finance/transactions/new${selId && view === 'account' ? `?accountId=${selId}` : ''}`)}
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
          <p className="text-center text-slate-400 py-12">Select a {view} above to view transactions.</p>
        )}
      </div>

      <NavBar links={navLinks} />
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
