// beacon2/frontend/src/pages/finance/TransactionEditor.jsx
// Add or edit a financial transaction — implements Beacon doc 7.2.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { finance as financeApi, groups as groupsApi, members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

const PAYMENT_METHODS = ['', 'Cash', 'Cheque', 'Standing Order', 'Direct Debit', 'Online', 'Other'];

const today = () => new Date().toISOString().slice(0, 10);

const BLANK = {
  account_id:     '',
  date:           today(),
  type:           'in',
  from_to:        '',
  amount:         '',
  payment_method: '',
  payment_ref:    '',
  detail:         '',
  remarks:        '',
  member_id_1:    '',
  member_id_2:    '',
  group_id:       '',
};

export default function TransactionEditor() {
  const { id }           = useParams();
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const { can, tenant }  = useAuth();
  const isNew            = !id || id === 'new';

  const [form,       setForm]       = useState({ ...BLANK, account_id: searchParams.get('accountId') ?? '' });
  const [categories, setCategories] = useState([]);   // all active finance categories
  const [catAmounts, setCatAmounts] = useState({});    // { category_id: string_amount }
  const [accounts,   setAccounts]   = useState([]);
  const [groups,     setGroups]     = useState([]);
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
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  // Load reference data
  useEffect(() => {
    async function loadRef() {
      try {
        const [acc, cat, grp, mem] = await Promise.all([
          financeApi.listAccounts(),
          financeApi.listCategories(),
          groupsApi.list(),
          membersApi.list(),
        ]);
        setAccounts(acc.filter((a) => a.active));
        setCategories(cat.filter((c) => c.active));
        setGroups(grp);
        setAllMembers(mem);
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
          group_id:       t.group_id       ?? '',
        });
        setCleared(!!t.cleared_at);
        setTxnNumber(t.transaction_number);
        setBatchId(t.batch_id ?? null);
        setBatchRef(t.batch_ref ?? null);
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

  const set = (k, v) => { markDirty(); setForm((f) => ({ ...f, [k]: v })); };

  const catTotal = useMemo(() => {
    return Object.values(catAmounts).reduce((s, v) => {
      const n = parseFloat(v);
      return s + (isNaN(n) ? 0 : n);
    }, 0);
  }, [catAmounts]);

  const amountNum = parseFloat(form.amount);
  const amountOk  = !isNaN(amountNum) && amountNum > 0;
  const catOk     = amountOk && Math.abs(catTotal - amountNum) < 0.005;

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
      member_id_1:    form.member_id_1    || null,
      member_id_2:    form.member_id_2    || null,
      group_id:       form.group_id       || null,
      categories:     cats,
    };
    if (removeBatch) payload.batch_id = null;
    return payload;
  }

  function validate() {
    if (!form.account_id) return 'Please select an account.';
    if (!form.date)       return 'Please enter a date.';
    if (!amountOk)        return 'Please enter a valid positive amount.';
    if (catTotal === 0)   return 'Please assign at least one category amount.';
    if (!catOk)           return `Category total (£${catTotal.toFixed(2)}) must equal amount (£${amountNum.toFixed(2)}).`;
    return null;
  }

  async function handleSave(e, addAnother = false) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (isNew) {
        const result = await financeApi.createTransaction(payload);
        if (addAnother) {
          markClean();
          setSaved(true);
          clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => {
            setSaved(false);
            // Reset form but keep account, date, type, payment_method
            setForm((f) => ({ ...BLANK, account_id: f.account_id, date: f.date, type: f.type, payment_method: f.payment_method }));
            setCatAmounts({});
          }, 1000);
        } else {
          markClean();
          setSaved(true);
          clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => navigate(`/finance/transactions/${result.id}`), 1200);
        }
      } else {
        markClean();
        setSaved(true);
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

        {error && <p className="text-center text-red-600 py-2 mb-2">Error: {error}</p>}
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
                    disabled={cleared}
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
              <label className={LBL}>Account *</label>
              <select
                value={form.account_id}
                onChange={(e) => set('account_id', e.target.value)}
                disabled={cleared}
                className={INP}
              >
                <option value="">— select account —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className={LBL}>Date *</label>
              <DateInput
                value={form.date}
                onChange={(v) => set('date', v)}
                disabled={cleared}
                className={INP}
              />
            </div>

            {/* From / To */}
            <div>
              <label className={LBL}>{form.type === 'in' ? 'From' : 'To'}</label>
              <input
                type="text"
                value={form.from_to}
                onChange={(e) => set('from_to', e.target.value)}
                disabled={cleared}
                className={INP}
                placeholder={form.type === 'in' ? 'Person / body received from' : 'Person / body paid to'}
              />
            </div>

            {/* Amount */}
            <div>
              <label className={LBL}>Amount (£) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                disabled={cleared}
                className={INP}
                placeholder="0.00"
              />
            </div>

            {/* Payment method */}
            <div>
              <label className={LBL}>Payment method</label>
              <select
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
                disabled={cleared}
                className={INP}
              >
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m || '— none —'}</option>)}
              </select>
            </div>

            {/* Payment reference */}
            <div>
              <label className={LBL}>Payment reference</label>
              <input
                type="text"
                value={form.payment_ref}
                onChange={(e) => set('payment_ref', e.target.value)}
                disabled={cleared}
                className={INP}
                placeholder="Cheque number or other reference"
              />
            </div>

            {/* Detail */}
            <div className="sm:col-span-2">
              <label className={LBL}>Detail</label>
              <input
                type="text"
                value={form.detail}
                onChange={(e) => set('detail', e.target.value)}
                disabled={cleared}
                className={INP}
                placeholder="Concise reason shown in ledger"
              />
            </div>

            {/* Remarks */}
            <div className="sm:col-span-2">
              <label className={LBL}>Remarks</label>
              <textarea
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
                <label className={LBL}>Member 1</label>
                <input
                  type="text"
                  value={m1Filter}
                  onChange={(e) => setM1Filter(e.target.value)}
                  disabled={cleared}
                  className={`${INP} mb-1`}
                  placeholder="Search name / number…"
                />
                <select
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
                <label className={LBL}>Member 2</label>
                <input
                  type="text"
                  value={m2Filter}
                  onChange={(e) => setM2Filter(e.target.value)}
                  disabled={cleared}
                  className={`${INP} mb-1`}
                  placeholder="Search name / number…"
                />
                <select
                  value={form.member_id_2}
                  onChange={(e) => set('member_id_2', e.target.value)}
                  disabled={cleared}
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

              {/* Group */}
              <div>
                <label className={LBL}>Group</label>
                <select
                  value={form.group_id}
                  onChange={(e) => set('group_id', e.target.value)}
                  disabled={cleared}
                  className={INP}
                  size={5}
                >
                  <option value="">— none —</option>
                  {groups.map((g) => (
                    <option
                      key={g.id}
                      value={g.id}
                      style={g.status === 'inactive' ? { color: '#dc2626' } : {}}
                    >
                      {g.name}{g.status === 'inactive' ? ' (inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Category allocation *</h2>
            <p className="text-xs text-slate-500 mb-3">
              Amounts must add up to the transaction amount.
              {amountOk && (
                <span className={catOk ? ' text-green-700 font-medium' : ' text-red-600 font-medium'}>
                  {' '}Total: £{catTotal.toFixed(2)} / £{amountNum.toFixed(2)}
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
                            min="0"
                            step="0.01"
                            value={catAmounts[cat.id] ?? ''}
                            onChange={(e) => { markDirty(); setCatAmounts((prev) => ({ ...prev, [cat.id]: e.target.value })); }}
                            disabled={cleared}
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
          {!cleared && (
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="submit"
                disabled={saving || deleting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {isNew && (
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={(e) => handleSave(e, true)}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
                >
                  Save &amp; Add Another
                </button>
              )}
              {!isNew && can('finance_transactions', 'delete') && (
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
          )}
        </form>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
