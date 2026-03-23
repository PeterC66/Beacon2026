// beacon2/frontend/src/pages/finance/TransferMoney.jsx
// Transfer money between finance accounts (doc 7.3).

import { useState, useEffect, useRef } from 'react';
import { finance as financeApi, requestBlob } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';
const btnSecondary = 'border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm transition-colors';
const btnDanger  = 'border border-red-300 text-red-600 hover:bg-red-50 rounded px-3 py-1 text-xs transition-colors';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  date: today(), amount: '', from_account_id: '', to_account_id: '',
  payment_ref: '', detail: '', remarks: '', group_id: '',
};

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransferMoney() {
  const { can, tenant } = useAuth();
  const [accounts,  setAccounts]  = useState([]);
  const [groups,    setGroups]    = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);   // transfer_id being edited
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState(null);
  const [saved,     setSaved]     = useState(false);
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [accs, xfers] = await Promise.all([
        financeApi.listAccounts(),
        can('finance_transfer_money', 'view') ? financeApi.listTransfers() : [],
      ]);
      setAccounts(accs);
      setTransfers(xfers);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function set(field, value) { markDirty(); setForm((prev) => ({ ...prev, [field]: value })); }

  function validate() {
    if (!form.date)            return 'Date is required.';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      return 'A positive amount is required.';
    if (!form.from_account_id) return 'From account is required.';
    if (!form.to_account_id)   return 'To account is required.';
    if (form.from_account_id === form.to_account_id) return 'From and To accounts must be different.';
    return null;
  }

  async function handleSave(e, addAnother = false) {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        date:            form.date,
        amount:          Number(form.amount),
        from_account_id: form.from_account_id,
        to_account_id:   form.to_account_id,
        payment_ref:     form.payment_ref || null,
        detail:          form.detail || null,
        remarks:         form.remarks || null,
        group_id:        form.group_id || null,
      };
      if (editId) {
        await financeApi.updateTransfer(editId, payload);
      } else {
        await financeApi.createTransfer(payload);
      }
      markClean();
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
      setEditId(null);
      setForm(EMPTY_FORM);
      await load();
      if (!addAnother) { /* stay on page, form already reset */ }
    } catch (err) {
      setFormError(err.message);
    } finally { setSaving(false); }
  }

  function handleEdit(t) {
    setEditId(t.id);
    setForm({
      date:            String(t.date).slice(0, 10),
      amount:          String(t.amount),
      from_account_id: t.from_account_id,
      to_account_id:   t.to_account_id,
      payment_ref:     t.payment_ref ?? '',
      detail:          t.detail ?? '',
      remarks:         t.remarks ?? '',
      group_id:        t.group_id ?? '',
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancel() {
    markClean();
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleDelete(t) {
    if (!confirm(`Delete transfer of £${fmtAmt(t.amount)} from ${t.from_account} to ${t.to_account} on ${fmtDate(t.date)}?`)) return;
    try {
      await financeApi.deleteTransfer(t.id);
      setTransfers((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err) { alert(err.message); }
  }

  const canCreate = can('finance_transfer_money', 'create');
  const canChange = can('finance_transfer_money', 'change');
  const canDelete = can('finance_transfer_money', 'delete');
  const navLinks  = [{ label: 'Home', to: '/' }, { label: 'Finance ledger', to: '/finance/ledger?view=account' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Transfer Money</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          Transfer money between accounts. Creates matching transactions in both accounts.
        </p>

        {loading && <p className="text-center text-slate-500">Loading…</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {/* Form */}
        {!loading && !error && canCreate && (
          <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
            <h2 className="text-base font-semibold text-slate-700 mb-4">
              {editId ? 'Edit Transfer' : 'New Transfer'}
            </h2>

            {saved && (
              <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">
                ✓ Transfer saved successfully.
              </p>
            )}
            {formError && (
              <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium mb-3">
                {formError}
              </p>
            )}

            <form noValidate onSubmit={(e) => handleSave(e, false)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input type="date" name="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (£) *</label>
                  <input type="number" name="amount" step="0.01" min="0.01" value={form.amount}
                    onChange={(e) => set('amount', e.target.value)} className={inputCls} placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From account *</label>
                  <select name="from_account_id" value={form.from_account_id} onChange={(e) => set('from_account_id', e.target.value)} className={inputCls}>
                    <option value="">— select —</option>
                    {accounts.filter((a) => a.active || a.id === form.from_account_id).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To account *</label>
                  <select name="to_account_id" value={form.to_account_id} onChange={(e) => set('to_account_id', e.target.value)} className={inputCls}>
                    <option value="">— select —</option>
                    {accounts.filter((a) => a.active || a.id === form.to_account_id).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment reference</label>
                  <input type="text" name="payment_ref" value={form.payment_ref} onChange={(e) => set('payment_ref', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Detail</label>
                  <input type="text" name="detail" value={form.detail} onChange={(e) => set('detail', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea name="remarks" value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
                  rows={2} className={inputCls} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Save'}
                </button>
                {!editId && (
                  <button type="button" disabled={saving} className={btnSecondary}
                    onClick={(e) => handleSave(e, true)}>
                    Save &amp; Add Another
                  </button>
                )}
                {editId && (
                  <button type="button" onClick={handleCancel} className={btnSecondary}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Transfer list */}
        {!loading && !error && (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
            <h2 className="text-base font-semibold text-slate-700 px-4 py-3 border-b border-slate-200">
              All Transfers
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 font-normal italic">
                    <th className="px-4 py-2.5 font-normal">Date</th>
                    <th className="px-4 py-2.5 font-normal">From</th>
                    <th className="px-4 py-2.5 font-normal">To</th>
                    <th className="px-4 py-2.5 font-normal text-right">Amount (£)</th>
                    <th className="px-4 py-2.5 font-normal">Detail</th>
                    <th className="px-4 py-2.5 font-normal">Ref</th>
                    <th className="px-4 py-2.5 font-normal">Cleared</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-4 text-center text-slate-400">No transfers yet.</td></tr>
                  )}
                  {transfers.map((t, i) => (
                    <tr key={t.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-4 py-2">{t.from_account}</td>
                      <td className="px-4 py-2">{t.to_account}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtAmt(t.amount)}</td>
                      <td className="px-4 py-2 text-slate-600">{t.detail ?? ''}</td>
                      <td className="px-4 py-2 text-slate-500">{t.payment_ref ?? ''}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {t.cleared_at ? fmtDate(t.cleared_at) : ''}
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        {canChange && !t.cleared_at && (
                          <button onClick={() => handleEdit(t)} className="text-blue-600 hover:underline text-xs">edit</button>
                        )}
                        {canDelete && !t.cleared_at && (
                          <button onClick={() => handleDelete(t)} className={btnDanger}>delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
