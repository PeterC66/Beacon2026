// beacon2/frontend/src/pages/finance/TransactionEditor.jsx
// Add or edit a financial transaction — implements Beacon doc 7.2.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { finance as financeApi, groups as groupsApi, teams as teamsApi, members as membersApi, settings as settingsApi, calendar as calendarApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { scrollToFormError } from '../../lib/scrollToError.js';

const PAYMENT_METHODS = ['', 'Cheque', 'Cash', 'PayPal', 'Standing Order', 'Direct Debit',
                         'BACS', 'Debit card', 'Account transfer', 'Credit card'];

const today = () => new Date().toISOString().slice(0, 10);

const BLANK = {
  account_id:       '',
  date:             today(),
  type:             'in',
  from_to:          '',
  amount:           '',
  payment_method:   '',
  payment_ref:      '',
  detail:           '',
  remarks:          '',
  member_id_1:      '',
  member_id_2:      '',
  group_id:         '',
  event_id:         '',
  pending:          false,
  gift_aid_amount:  '',
  gift_aid_amount_2: '',
};

export default function TransactionEditor() {
  const { id }           = useParams();
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const { can, tenant }  = useAuth();
  const isNew            = !id || id === 'new';

  const [form,       setForm]       = useState({ ...BLANK, account_id: searchParams.get('accountId') ?? '', event_id: searchParams.get('eventId') ?? '' });
  const [categories, setCategories] = useState([]);   // all active finance categories
  const [catAmounts, setCatAmounts] = useState({});    // { category_id: string_amount }
  const [accounts,   setAccounts]   = useState([]);
  const [groups,     setGroups]     = useState([]);
  const [teams,      setTeams]      = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [allMembers, setAllMembers] = useState([]);
  const [m1Filter,   setM1Filter]   = useState('');
  const [m2Filter,   setM2Filter]   = useState('');
  const [loading,    setLoading]    = useState(!isNew);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState(null);
  const [cleared,    setCleared]    = useState(false);
  const [txnNumber,  setTxnNumber]  = useState(null);
  const [saved,      setSaved]      = useState(false);
  const [batchId,    setBatchId]    = useState(null);
  const [batchRef,   setBatchRef]   = useState(null);
  const [removeBatch, setRemoveBatch] = useState(false);
  const [isTransfer, setIsTransfer] = useState(false);
  const [refundOfId, setRefundOfId] = useState(null);
  const [refundOfTxn, setRefundOfTxn] = useState(null);
  const [refundedById, setRefundedById] = useState(null);
  const [refundedByTxn, setRefundedByTxn] = useState(null);
  const [refundedAmount, setRefundedAmount] = useState(null);
  const [canRefund, setCanRefund] = useState(false);
  const [giftAidClaimedAt,  setGiftAidClaimedAt]  = useState(null);
  const [giftAidClaimedAt2, setGiftAidClaimedAt2] = useState(null);
  const [eventSearch,  setEventSearch]  = useState('');
  const [eventResults, setEventResults] = useState([]);
  const [eventLabel,   setEventLabel]   = useState('');
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  // Load reference data
  useEffect(() => {
    async function loadRef() {
      try {
        const [acc, cat, grp, tm, mem, sysSettings] = await Promise.all([
          financeApi.listAccounts(),
          financeApi.listCategories(),
          groupsApi.list({ activeOnly: false }),
          teamsApi.list({ activeOnly: false }),
          membersApi.list(),
          isNew ? settingsApi.get().catch(() => null) : null,
        ]);
        setAccounts(acc.filter((a) => a.active));
        setCategories(cat.filter((c) => c.active));
        setGroups(grp);
        setTeams(tm);
        setAllMembers(mem);
        // Pre-fill default payment method from system settings for new transactions
        if (isNew && sysSettings?.default_payment_method) {
          setForm((f) => f.payment_method ? f : { ...f, payment_method: sysSettings.default_payment_method });
        }
      } catch (err) {
        setError(err.message);
      }
    }
    loadRef();
  }, []);

  // Load existing transaction
  useEffect(() => {
    if (isNew) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const t = await financeApi.getTransaction(id);
        setForm({
          account_id:     t.account_id     ?? '',
          date:           t.date           ?? today(),
          type:           t.type           ?? 'in',
          from_to:        t.from_to        ?? '',
          amount:         t.amount != null ? String(t.amount) : '',
          payment_method: t.payment_method ?? '',
          payment_ref:    t.payment_ref    ?? '',
          detail:         t.detail         ?? '',
          remarks:        t.remarks        ?? '',
          member_id_1:    t.member_id_1    ?? '',
          member_id_2:    t.member_id_2    ?? '',
          group_id:          t.group_id          ?? '',
          event_id:          t.event_id          ?? '',
          pending:           t.pending           ?? false,
          gift_aid_amount:   t.gift_aid_amount != null ? String(t.gift_aid_amount) : '',
          gift_aid_amount_2: t.gift_aid_amount_2 != null ? String(t.gift_aid_amount_2) : '',
        });
        setGiftAidClaimedAt(t.gift_aid_claimed_at ?? null);
        setGiftAidClaimedAt2(t.gift_aid_claimed_at_2 ?? null);
        setCleared(!!t.cleared_at);
        setTxnNumber(t.transaction_number);
        setBatchId(t.batch_id ?? null);
        setBatchRef(t.batch_ref ?? null);
        setIsTransfer(!!t.transfer_id);
        setRefundOfId(t.refund_of_id ?? null);
        setRefundOfTxn(t.refund_of_txn_number ?? null);
        setRefundedById(t.refunded_by_id ?? null);
        setRefundedByTxn(t.refunded_by_txn_number ?? null);
        setRefundedAmount(t.refunded_amount ?? null);
        setCanRefund(
          !!t.account_enable_refunds && !t.cleared_at && !t.transfer_id &&
          !t.refund_of_id && !t.refunded_by_id && !t.gift_aid_claimed_at && !t.gift_aid_claimed_at_2
        );
        // populate category amounts
        const amounts = {};
        if (Array.isArray(t.categories)) {
          t.categories.forEach((c) => { amounts[c.category_id] = String(c.amount); });
        }
        setCatAmounts(amounts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isNew]);

  // Load event label when existing transaction has event_id
  useEffect(() => {
    if (!form.event_id) { setEventLabel(''); return; }
    calendarApi.getEvent(form.event_id).then((ev) => {
      const lbl = ev.topic || ev.group_name || ev.event_type_name || '';
      const d = ev.event_date ? String(ev.event_date).slice(0, 10) : '';
      setEventLabel(`${lbl}${d ? ` (${d})` : ''}`);
    }).catch(() => setEventLabel(''));
  }, [form.event_id]);

  // Event search-as-you-type
  useEffect(() => {
    if (eventSearch.length < 2) { setEventResults([]); return; }
    const timer = setTimeout(() => {
      calendarApi.searchEvents(eventSearch).then(setEventResults).catch(() => setEventResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [eventSearch]);

  const set = (k, v) => {
    markDirty();
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Clear member 2 when member 1 is cleared
      if (k === 'member_id_1' && !v) {
        next.member_id_2 = '';
        next.gift_aid_amount_2 = '';
      }
      return next;
    });
  };

  // Determine pending configuration for the selected account
  const selectedAccount = accounts.find((a) => a.id === form.account_id);
  const pendingConfig = selectedAccount?.pending_config ?? 'disabled';
  const showPending = pendingConfig === 'optional' && !isTransfer;
  const readOnly = cleared || !!refundedById || !!refundOfId;

  const catTotal = useMemo(() => {
    return Object.values(catAmounts).reduce((s, v) => {
      const n = parseFloat(v);
      return s + (isNaN(n) ? 0 : n);
    }, 0);
  }, [catAmounts]);

  const amountNum = parseFloat(form.amount);
  const amountOk  = !isNaN(amountNum) && amountNum > 0;
  const catOk     = amountOk && Math.abs(catTotal - amountNum) < 0.005;

  const giftAidTotal = (parseFloat(form.gift_aid_amount) || 0) + (parseFloat(form.gift_aid_amount_2) || 0);

  const filteredM1 = useMemo(() => {
    const q = m1Filter.trim().toLowerCase();
    if (!q) return allMembers.slice(0, 50);
    return allMembers.filter((m) =>
      `${m.forenames} ${m.surname}`.toLowerCase().includes(q) ||
      String(m.membership_number).includes(q)
    ).slice(0, 50);
  }, [allMembers, m1Filter]);

  const filteredM2 = useMemo(() => {
    const q = m2Filter.trim().toLowerCase();
    if (!q) return allMembers.slice(0, 50);
    return allMembers.filter((m) =>
      `${m.forenames} ${m.surname}`.toLowerCase().includes(q) ||
      String(m.membership_number).includes(q)
    ).slice(0, 50);
  }, [allMembers, m2Filter]);

  const filteredGroups = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      (g.short_name && g.short_name.toLowerCase().includes(q))
    );
  }, [groups, groupFilter]);

  const filteredTeams = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.short_name && t.short_name.toLowerCase().includes(q))
    );
  }, [teams, groupFilter]);

  function buildPayload() {
    const cats = Object.entries(catAmounts)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([category_id, v]) => ({ category_id, amount: parseFloat(v) }));

    const payload = {
      account_id:     form.account_id     || undefined,
      date:           form.date           || undefined,
      type:           form.type,
      from_to:        form.from_to        || null,
      amount:         parseFloat(form.amount),
      payment_method: form.payment_method || null,
      payment_ref:    form.payment_ref    || null,
      detail:         form.detail         || null,
      remarks:        form.remarks        || null,
      member_id_1:       form.member_id_1    || null,
      member_id_2:       form.member_id_2    || null,
      group_id:          form.group_id       || null,
      event_id:          form.event_id       || null,
      pending:           form.pending,
      gift_aid_amount:   form.member_id_1 && form.type === 'in' && parseFloat(form.gift_aid_amount) > 0
                           ? parseFloat(form.gift_aid_amount) : null,
      gift_aid_amount_2: form.member_id_2 && form.type === 'in' && parseFloat(form.gift_aid_amount_2) > 0
                           ? parseFloat(form.gift_aid_amount_2) : null,
      categories:     cats,
    };
    if (removeBatch) payload.batch_id = null;
    return payload;
  }

  function validate() {
    if (!form.account_id)        return 'Please select an account.';
    if (!form.date)              return 'Please enter a date.';
    if (!form.from_to.trim())    return `Please enter the '${form.type === 'in' ? 'From' : 'To'}' field.`;
    if (!amountOk)               return 'Please enter a valid positive amount.';
    if (form.member_id_2 && !form.member_id_1) return 'Member 2 cannot be set without Member 1.';
    if (form.member_id_2 && form.member_id_1 === form.member_id_2) return 'Member 1 and Member 2 cannot be the same.';
    if (giftAidTotal > amountNum + 0.005) return `Total gift aid eligible (£${giftAidTotal.toFixed(2)}) cannot exceed the transaction amount (£${amountNum.toFixed(2)}).`;
    if (catTotal === 0)          return 'Please assign at least one category amount.';
    if (!catOk)                  return `Category total (£${catTotal.toFixed(2)}) must equal amount (£${amountNum.toFixed(2)}).`;
    return null;
  }

  async function handleSave(e, addAnother = false) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); scrollToFormError(); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (isNew) {
        const result = await financeApi.createTransaction(payload);
        if (addAnother) {
          markClean();
          setSaved(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => {
            setSaved(false);
            // Reset form but keep account, date, type, payment_method
            setForm((f) => ({ ...BLANK, account_id: f.account_id, date: f.date, type: f.type, payment_method: f.payment_method, pending: false }));
            setCatAmounts({});
          }, 1000);
        } else {
          markClean();
          setSaved(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => navigate(`/finance/transactions/${result.id}`), 1200);
        }
      } else {
        markClean();
        setSaved(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => navigate(`/finance/transactions/${id}`), 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      await financeApi.deleteTransaction(id);
      markClean();
      navigate('/finance/ledger');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  const navLinks = [
    { label: 'Home',   to: '/' },
    { label: 'Ledger', to: '/finance/ledger' },
    ...(!isNew && canRefund ? [{ label: 'Refund this transaction', to: `/finance/transactions/${id}/refund` }] : []),
  ];

  const INP = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
  const LBL = 'block text-sm font-medium text-slate-700 mb-1';

  if (loading) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <p className="text-center text-slate-500 py-12">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">
          {isNew ? 'Add Transaction' : `Transaction #${txnNumber}`}
        </h1>

        {cleared && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded px-4 py-2 text-sm mb-4">
            This transaction has been cleared and cannot be changed or deleted.
          </div>
        )}

        {refundedById && (
          <div className="bg-blue-50 border border-blue-300 text-blue-800 rounded px-4 py-2 text-sm mb-4">
            This transaction has been {refundedAmount < Number(form.amount) ? 'partially ' : ''}refunded
            {refundedAmount != null && ` (£${Number(refundedAmount).toFixed(2)})`}.{' '}
            <button
              onClick={() => navigate(`/finance/transactions/${refundedById}`)}
              className="text-blue-600 hover:underline font-medium"
            >
              Refund #{refundedByTxn} ...
            </button>
          </div>
        )}

        {refundOfId && (
          <div className="bg-purple-50 border border-purple-300 text-purple-800 rounded px-4 py-2 text-sm mb-4">
            This is a refund of transaction{' '}
            <button
              onClick={() => navigate(`/finance/transactions/${refundOfId}`)}
              className="text-purple-600 hover:underline font-medium"
            >
              #{refundOfTxn} ...
            </button>
          </div>
        )}

        {error && <p data-form-error className="text-center text-red-600 py-2 mb-2">Error: {error}</p>}
        {saved && (
          <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 text-center mb-2">
            ✓ Saved successfully.
          </p>
        )}

        <form onSubmit={(e) => handleSave(e, false)} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">

            {/* Type toggle */}
            <div className="sm:col-span-2">
              <label className={LBL}>Transaction type</label>
              <div className="flex gap-2">
                {[['in', 'Money received'], ['out', 'Payment']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    disabled={readOnly}
                    onClick={() => set('type', val)}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      form.type === val
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Account */}
            <div>
              <label htmlFor="txn-account" className={LBL}>Account <RequiredMark /></label>
              <select
                id="txn-account"
                name="account_id"
                value={form.account_id}
                onChange={(e) => set('account_id', e.target.value)}
                disabled={readOnly}
                className={INP}
              >
                <option value="">— select account —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="txn-date" className={LBL}>Date <RequiredMark /></label>
              <DateInput
                id="txn-date"
                name="date"
                value={form.date}
                onChange={(v) => set('date', v)}
                disabled={readOnly}
                className={INP}
              />
            </div>

            {/* From / To */}
            <div>
              <label htmlFor="txn-from-to" className={LBL}>{form.type === 'in' ? 'From' : 'To'} <RequiredMark /></label>
              <input
                id="txn-from-to"
                type="text"
                name="from_to"
                value={form.from_to}
                onChange={(e) => set('from_to', e.target.value)}
                disabled={readOnly}
                className={INP}
                placeholder={form.type === 'in' ? 'Person / body received from' : 'Person / body paid to'}
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="txn-amount" className={LBL}>Amount (£) <RequiredMark /></label>
              <input
                id="txn-amount"
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                disabled={readOnly}
                className={INP}
                placeholder="0.00"
              />
            </div>

            {/* Payment method */}
            <div>
              <label htmlFor="txn-payment-method" className={LBL}>Payment method</label>
              <select
                id="txn-payment-method"
                name="payment_method"
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
                disabled={readOnly}
                className={INP}
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m || '— none —'}</option>)}
              </select>
            </div>

            {/* Payment reference */}
            <div>
              <label htmlFor="txn-payment-ref" className={LBL}>Payment reference</label>
              <input
                id="txn-payment-ref"
                type="text"
                name="payment_ref"
                value={form.payment_ref}
                onChange={(e) => set('payment_ref', e.target.value)}
                disabled={readOnly}
                className={INP}
                placeholder="Cheque number or other reference"
              />
            </div>

            {/* Pending checkbox — only shown when account has pending_config = 'optional' */}
            {showPending && (
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="txn-pending"
                  checked={form.pending}
                  onChange={(e) => set('pending', e.target.checked)}
                  disabled={cleared}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="txn-pending" className="text-sm font-medium text-slate-700">
                  Pending (payment promised but not yet received)
                </label>
              </div>
            )}

            {/* Pending info for by_type mode */}
            {pendingConfig === 'by_type' && !isTransfer && (
              <div className="sm:col-span-2">
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                  Pending status is set automatically based on payment method for this account.
                  {form.pending && ' This transaction is currently pending.'}
                </p>
              </div>
            )}

            {/* Detail */}
            <div className="sm:col-span-2">
              <label htmlFor="txn-detail" className={LBL}>Detail</label>
              <input
                id="txn-detail"
                type="text"
                name="detail"
                value={form.detail}
                onChange={(e) => set('detail', e.target.value)}
                disabled={readOnly}
                className={INP}
                placeholder="Concise reason shown in ledger"
              />
            </div>

            {/* Remarks */}
            <div className="sm:col-span-2">
              <label htmlFor="txn-remarks" className={LBL}>Remarks</label>
              <textarea
                id="txn-remarks"
                name="remarks"
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                disabled={cleared}
                rows={3}
                className={INP}
                placeholder="Additional notes"
              />
            </div>
          </div>

          {/* Associate with members / group */}
          <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Associate transaction with</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Member 1 */}
              <div>
                <label htmlFor="txn-member1" className={LBL}>Member 1</label>
                <input
                  id="txn-member1-filter"
                  type="text"
                  name="m1Filter"
                  value={m1Filter}
                  onChange={(e) => setM1Filter(e.target.value)}
                  disabled={cleared}
                  className={`${INP} mb-1`}
                  placeholder="Search name / number…"
                />
                <select
                  id="txn-member1"
                  name="member_id_1"
                  value={form.member_id_1}
                  onChange={(e) => set('member_id_1', e.target.value)}
                  disabled={cleared}
                  className={INP}
                  size={4}
                >
                  <option value="">— none —</option>
                  {filteredM1.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.membership_number} {m.forenames} {m.surname}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member 2 */}
              <div>
                <label htmlFor="txn-member2" className={LBL}>Member 2</label>
                {!form.member_id_1 && (
                  <p className="text-xs text-slate-400 mb-1">Select Member 1 first</p>
                )}
                <input
                  id="txn-member2-filter"
                  type="text"
                  name="m2Filter"
                  value={m2Filter}
                  onChange={(e) => setM2Filter(e.target.value)}
                  disabled={cleared || !form.member_id_1}
                  className={`${INP} mb-1`}
                  placeholder="Search name / number…"
                />
                <select
                  id="txn-member2"
                  name="member_id_2"
                  value={form.member_id_2}
                  onChange={(e) => set('member_id_2', e.target.value)}
                  disabled={cleared || !form.member_id_1}
                  className={INP}
                  size={4}
                >
                  <option value="">— none —</option>
                  {filteredM2.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.membership_number} {m.forenames} {m.surname}
                    </option>
                  ))}
                </select>
              </div>

              {/* Group / Team */}
              <div>
                <label htmlFor="txn-group-filter" className={LBL}>Group / Team</label>
                <input
                  id="txn-group-filter"
                  type="text"
                  placeholder="Search name / abbreviation…"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  disabled={cleared}
                  className={`${INP} mb-1`}
                />
                <select
                  id="txn-group"
                  name="group_id"
                  value={form.group_id}
                  onChange={(e) => set('group_id', e.target.value)}
                  disabled={cleared}
                  className={INP}
                  size={5}
                >
                  <option value="">— none —</option>
                  {filteredGroups.length > 0 && (
                    <optgroup label="Groups">
                      {filteredGroups.map((g) => (
                        <option key={g.id} value={g.id} style={g.status === 'inactive' ? { color: '#dc2626' } : {}}>
                          {g.short_name || g.name}{g.status === 'inactive' ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {filteredTeams.length > 0 && (
                    <optgroup label="Teams">
                      {filteredTeams.map((t) => (
                        <option key={t.id} value={t.id} style={t.status === 'inactive' ? { color: '#dc2626' } : {}}>
                          {t.short_name || t.name}{t.status === 'inactive' ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Event */}
              <div>
                <label htmlFor="txn-event-search" className={LBL}>Event</label>
                {form.event_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700">{eventLabel || form.event_id}</span>
                    <button type="button" onClick={() => { set('event_id', ''); setEventLabel(''); setEventSearch(''); }}
                      disabled={cleared}
                      className="text-red-600 hover:underline text-xs">Clear</button>
                  </div>
                ) : (
                  <>
                    <input
                      id="txn-event-search"
                      type="text"
                      placeholder="Search by topic, group name, or date…"
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      disabled={cleared}
                      className={`${INP} mb-1`}
                    />
                    {eventResults.length > 0 && (
                      <ul className="border border-slate-200 rounded max-h-40 overflow-y-auto text-sm">
                        {eventResults.map((ev) => {
                          const lbl = ev.topic || ev.group_name || ev.event_type_name || 'Event';
                          const d = ev.event_date ? String(ev.event_date).slice(0, 10) : '';
                          return (
                            <li key={ev.id}>
                              <button type="button"
                                onClick={() => { set('event_id', ev.id); setEventLabel(`${lbl} (${d})`); setEventSearch(''); setEventResults([]); }}
                                className="block w-full text-left px-2 py-1 hover:bg-blue-50">
                                {lbl}{d ? ` — ${d}` : ''}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Gift Aid */}
          {form.type === 'in' && (form.member_id_1 || form.member_id_2) && (
            <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Gift Aid</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.member_id_1 && (
                  <div>
                    <label htmlFor="txn-ga-amount1" className={LBL}>Gift aid eligible (Member 1)</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-sm">£</span>
                      <input
                        id="txn-ga-amount1"
                        type="number" name="gift_aid_amount" min="0" step="0.01"
                        value={form.gift_aid_amount}
                        onChange={(e) => set('gift_aid_amount', e.target.value)}
                        disabled={readOnly || !!giftAidClaimedAt}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        title="Enter the amount (if any) that is eligible for Gift Aid"
                      />
                    </div>
                    {giftAidClaimedAt && (
                      <div className="mt-2">
                        <label htmlFor="txn-ga-claimed1" className={LBL}>Gift aid claimed</label>
                        <input
                          id="txn-ga-claimed1"
                          type="text"
                          value={new Date(giftAidClaimedAt).toLocaleDateString('en-GB')}
                          readOnly
                          className="border border-slate-200 bg-slate-50 rounded px-2 py-1 text-sm w-32 text-slate-600"
                          title="The date on which Gift Aid was claimed. This field is normally entered automatically."
                        />
                      </div>
                    )}
                  </div>
                )}
                {form.member_id_2 && (
                  <div>
                    <label htmlFor="txn-ga-amount2" className={LBL}>Gift aid eligible (Member 2)</label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-sm">£</span>
                      <input
                        id="txn-ga-amount2"
                        type="number" name="gift_aid_amount_2" min="0" step="0.01"
                        value={form.gift_aid_amount_2}
                        onChange={(e) => set('gift_aid_amount_2', e.target.value)}
                        disabled={readOnly || !!giftAidClaimedAt2}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        title="Enter the amount (if any) that is eligible for Gift Aid"
                      />
                    </div>
                    {giftAidClaimedAt2 && (
                      <div className="mt-2">
                        <label htmlFor="txn-ga-claimed2" className={LBL}>Gift aid claimed</label>
                        <input
                          id="txn-ga-claimed2"
                          type="text"
                          value={new Date(giftAidClaimedAt2).toLocaleDateString('en-GB')}
                          readOnly
                          className="border border-slate-200 bg-slate-50 rounded px-2 py-1 text-sm w-32 text-slate-600"
                          title="The date on which Gift Aid was claimed. This field is normally entered automatically."
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Category allocation <RequiredMark /></h2>
            <p className="text-xs text-slate-500 mb-3">
              Amounts must add up to the transaction amount.
              {amountOk && (
                <span className={catOk ? ' text-green-700 font-medium' : ' text-red-600 font-medium'}>
                  {' '}Total: £{catTotal.toFixed(2)} / £{amountNum.toFixed(2)}
                  {!catOk && ` — difference £${Math.abs(catTotal - amountNum).toFixed(2)}`}
                </span>
              )}
            </p>

            {categories.length === 0 ? (
              <p className="text-sm text-slate-400">No active categories. Add categories in Finance set-up.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="py-1.5 pr-4 font-medium">Category</th>
                      <th className="py-1.5 w-36 font-medium">Amount (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-slate-100">
                        <td className="py-1.5 pr-4">{cat.name}</td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            name="categoryAmount"
                            min="0"
                            step="0.01"
                            value={catAmounts[cat.id] ?? ''}
                            onChange={(e) => { markDirty(); setCatAmounts((prev) => ({ ...prev, [cat.id]: e.target.value })); }}
                            disabled={readOnly}
                            className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Credit Batch membership */}
          {!isNew && batchId && (
            <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Credit Batch</h2>
              <p className="text-sm text-slate-600 mb-2">
                This transaction belongs to batch <span className="font-medium">{batchRef}</span>.
              </p>
              {!cleared && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={removeBatch}
                    onChange={(e) => { markDirty(); setRemoveBatch(e.target.checked); }}
                  />
                  Remove from batch on save
                </label>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            {!readOnly && (
              <button
                type="submit"
                disabled={saving || deleting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            {isNew && !readOnly && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={(e) => handleSave(e, true)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
              >
                Save &amp; Add Another
              </button>
            )}
            {!isNew && can('finance_transactions', 'delete') && !cleared && !refundedById && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={handleDelete}
                className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-6 py-2 text-sm transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-6 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
