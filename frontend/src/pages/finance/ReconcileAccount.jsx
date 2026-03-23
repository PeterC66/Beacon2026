// beacon2/frontend/src/pages/finance/ReconcileAccount.jsx
// Bank account reconciliation (doc 7.5).

import { useState, useEffect } from 'react';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';
const btnSecondary = 'border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm transition-colors';

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReconcileAccount() {
  const { can, tenant } = useAuth();
  const [accounts,        setAccounts]        = useState([]);
  const [accountId,       setAccountId]       = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [statementDate,   setStatementDate]   = useState(new Date().toISOString().slice(0, 10));
  const [data,            setData]            = useState(null);   // { account, clearedBalance, uncleared }
  const [selected,        setSelected]        = useState({});    // { txnId: true/false }
  const [loading,         setLoading]         = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error,           setError]           = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    try { setAccounts(await financeApi.listAccounts()); }
    catch (err) { setError(err.message); }
    finally { setLoadingAccounts(false); }
  }

  async function handleShow(e) {
    e.preventDefault();
    if (!accountId) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSelected({});
    try {
      const d = await financeApi.getReconcileData(accountId);
      setData(d);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function toggleTxn(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll() {
    const next = {};
    (data?.uncleared ?? []).forEach((t) => { next[t.id] = true; });
    setSelected(next);
  }

  function clearAll() { setSelected({}); }

  // Balance difference = clearedBalance + (selected in - selected out) - statementBalance
  function computeDiff() {
    if (!data) return null;
    const stmtBal = parseFloat(statementBalance);
    if (isNaN(stmtBal)) return null;
    const selectedTxns = (data.uncleared ?? []).filter((t) => selected[t.id]);
    const selectedNet  = selectedTxns.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
    return data.clearedBalance + selectedNet - stmtBal;
  }

  async function handleReconcile() {
    if (!data) return;
    const diff = computeDiff();
    if (diff === null) { alert('Enter the statement end balance first.'); return; }
    if (Math.abs(diff) > 0.005) {
      if (!confirm(`Balance difference is £${fmtAmt(diff)} (not zero). Reconcile anyway?`)) return;
    }
    setSaving(true);
    try {
      const selectedItems = (data.uncleared ?? []).filter((t) => selected[t.id]);
      const transactionIds = selectedItems.filter((t) => !t.is_batch).map((t) => t.id);
      const batchIds       = selectedItems.filter((t) => t.is_batch).map((t) => t.id);
      await financeApi.reconcile({ accountId, statementDate, transactionIds, batchIds });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Reload
      const d = await financeApi.getReconcileData(accountId);
      setData(d);
      setSelected({});
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const canReconcile = can('finance_reconcile', 'reconcile');
  const diff         = computeDiff();
  const navLinks     = [{ label: 'Home', to: '/' }, { label: 'Finance ledger', to: '/finance/ledger?view=account' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-2">Reconcile Account</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          Ensure Beacon's ledger matches your bank statement. Tick transactions to mark them as cleared.
        </p>

        {/* Selection form */}
        <form onSubmit={handleShow} className="bg-white/90 rounded-lg shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
              <select name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">— select —</option>
                {accounts.filter((a) => a.active).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statement end balance (£)</label>
              <input type="number" name="statementBalance" step="0.01" value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                className={`${inputCls} w-full`} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statement end date</label>
              <input type="date" name="statementDate" value={statementDate} onChange={(e) => setStatementDate(e.target.value)}
                className={`${inputCls} w-full`} />
            </div>
          </div>
          <div className="mt-3">
            <button type="submit" disabled={!accountId || loading} className={btnPrimary}>
              {loading ? 'Loading…' : 'Show uncleared transactions'}
            </button>
          </div>
        </form>

        {error && <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm mb-4">{error}</p>}

        {saved && (
          <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
            ✓ Reconciliation saved.
          </p>
        )}

        {/* Balance summary */}
        {data && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Account</p>
              <p className="font-semibold">{data.account.name}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Cleared balance</p>
              <p className="font-semibold font-mono">£{fmtAmt(data.clearedBalance)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Statement balance</p>
              <p className="font-semibold font-mono">
                {statementBalance !== '' ? `£${fmtAmt(parseFloat(statementBalance) || 0)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Balance difference</p>
              <p className={`font-bold font-mono text-base ${diff !== null && Math.abs(diff) < 0.005 ? 'text-green-600' : 'text-orange-600'}`}>
                {diff !== null ? `£${fmtAmt(diff)}` : '—'}
              </p>
              {diff !== null && Math.abs(diff) < 0.005 && (
                <p className="text-green-600 text-xs">✓ Balanced!</p>
              )}
            </div>
          </div>
        )}

        {/* Uncleared transactions */}
        {data && (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-700">
                Uncleared transactions ({data.uncleared.length})
              </h2>
              <div className="flex gap-2">
                <button onClick={selectAll} className={btnSecondary}>Select all</button>
                <button onClick={clearAll}  className={btnSecondary}>Clear all</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 font-normal italic">
                    <th className="px-3 py-2.5 font-normal">Cleared</th>
                    <th className="px-4 py-2.5 font-normal">#</th>
                    <th className="px-4 py-2.5 font-normal">Date</th>
                    <th className="px-4 py-2.5 font-normal">Type</th>
                    <th className="px-4 py-2.5 font-normal">From/To</th>
                    <th className="px-4 py-2.5 font-normal">Detail</th>
                    <th className="px-4 py-2.5 font-normal">Ref</th>
                    <th className="px-4 py-2.5 font-normal text-right">In (£)</th>
                    <th className="px-4 py-2.5 font-normal text-right">Out (£)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.uncleared.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-4 text-center text-slate-400">All transactions are cleared.</td></tr>
                  )}
                  {data.uncleared.map((t, i) => (
                    <tr key={t.id}
                      className={`border-b border-slate-100 cursor-pointer ${selected[t.id] ? 'bg-blue-50' : t.is_batch ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                      onClick={() => toggleTxn(t.id)}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={!!selected[t.id]} readOnly
                          className="w-4 h-4 accent-blue-600" />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">
                        {t.is_batch ? '' : t.transaction_number}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-4 py-2">
                        {t.is_batch ? (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            Batch ({t.txn_count})
                          </span>
                        ) : (
                          <>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${t.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {t.type === 'in' ? 'In' : 'Out'}
                            </span>
                            {t.is_transfer && <span className="ml-1 text-xs text-slate-400">transfer</span>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{t.from_to ?? ''}</td>
                      <td className="px-4 py-2 text-slate-600">{t.is_batch ? t.batch_ref : (t.detail ?? '')}</td>
                      <td className="px-4 py-2 text-slate-500">{t.is_batch ? '' : (t.payment_ref ?? '')}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-700">
                        {t.type === 'in' ? fmtAmt(t.amount) : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">
                        {t.type === 'out' ? fmtAmt(t.amount) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && canReconcile && (
          <div className="flex justify-end">
            <button onClick={handleReconcile} disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Reconcile Account'}
            </button>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
