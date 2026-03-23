// beacon2/frontend/src/pages/finance/CreditBatches.jsx
// Credit Batches — list, view, create, add/remove transactions (doc 7.4).

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';
const btnDanger  = 'border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm';
const btnSecondary = 'border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm transition-colors';

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return '';
  return `${day}/${m}/${y}`;
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CreditBatches() {
  const { can, tenant } = useAuth();
  const [searchParams] = useSearchParams();
  const initialAccountId = searchParams.get('accountId') ?? '';

  // ─── List mode state ────────────────────────────────────────────────────
  const [accounts,  setAccounts]  = useState([]);
  const [accountId, setAccountId] = useState(initialAccountId);
  const [mode,      setMode]      = useState('uncleared'); // uncleared | since
  const [sinceDate, setSinceDate] = useState('');
  const [batches,   setBatches]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // ─── Detail mode state ──────────────────────────────────────────────────
  const [viewBatch, setViewBatch] = useState(null); // { id, batch_ref, transactions, ... }

  // ─── Create/Add mode state ──────────────────────────────────────────────
  const [showCreate,      setShowCreate]      = useState(searchParams.has('create'));
  const [unbatched,       setUnbatched]       = useState([]);
  const [selectedCreate,  setSelectedCreate]  = useState(new Set());
  const [batchRef,        setBatchRef]        = useState('');
  const [existingBatchId, setExistingBatchId] = useState('');
  const [creating,        setCreating]        = useState(false);
  const [loadingUnbatched, setLoadingUnbatched] = useState(false);

  // ─── Remove mode state ──────────────────────────────────────────────────
  const [selectedRemove, setSelectedRemove] = useState(new Set());
  const [removing,       setRemoving]       = useState(false);

  // ─── Feedback ───────────────────────────────────────────────────────────
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    try {
      const accs = await financeApi.listAccounts();
      setAccounts(accs.filter((a) => a.active));
    } catch (err) { setError(err.message); }
  }

  // ─── List batches ───────────────────────────────────────────────────────

  async function handleList(e) {
    if (e) e.preventDefault();
    if (!accountId) return;
    setLoading(true);
    setError(null);
    setViewBatch(null);
    setShowCreate(false);
    try {
      const params = { accountId, mode };
      if (mode === 'since' && sinceDate) params.date = sinceDate;
      const rows = await financeApi.listBatches(params);
      setBatches(rows);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // ─── View batch detail ──────────────────────────────────────────────────

  async function openBatch(batchId) {
    setLoading(true);
    setError(null);
    try {
      const detail = await financeApi.getBatch(batchId);
      setViewBatch(detail);
      setSelectedRemove(new Set());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // ─── Create / add to batch ─────────────────────────────────────────────

  async function openCreate() {
    if (!accountId) { setError('Select an account first.'); return; }
    setShowCreate(true);
    setLoadingUnbatched(true);
    setError(null);
    try {
      const rows = await financeApi.getUnbatched(accountId);
      setUnbatched(rows);
      setSelectedCreate(new Set());
      setBatchRef('');
      setExistingBatchId('');
    } catch (err) { setError(err.message); }
    finally { setLoadingUnbatched(false); }
  }

  function toggleCreate(id) {
    setSelectedCreate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreateBatch() {
    if (selectedCreate.size === 0) return;
    if (!batchRef.trim()) { setError('Enter a batch reference.'); return; }
    setCreating(true);
    setError(null);
    try {
      await financeApi.createBatch({
        account_id: accountId,
        batch_ref: batchRef.trim(),
        transactionIds: [...selectedCreate],
      });
      flashSaved();
      setShowCreate(false);
      handleList();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function handleAddToExisting() {
    if (selectedCreate.size === 0 || !existingBatchId) return;
    setCreating(true);
    setError(null);
    try {
      await financeApi.addToBatch(existingBatchId, [...selectedCreate]);
      flashSaved();
      setShowCreate(false);
      handleList();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  // ─── Remove transactions from batch ────────────────────────────────────

  function toggleRemove(id) {
    setSelectedRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleRemoveFromBatch() {
    if (!viewBatch || selectedRemove.size === 0) return;
    setRemoving(true);
    setError(null);
    try {
      await financeApi.removeFromBatch(viewBatch.id, [...selectedRemove]);
      flashSaved();
      await openBatch(viewBatch.id);
    } catch (err) { setError(err.message); }
    finally { setRemoving(false); }
  }

  // ─── Delete batch ──────────────────────────────────────────────────────

  async function handleDeleteBatch(batchId) {
    if (!confirm('Delete this empty batch?')) return;
    setError(null);
    try {
      await financeApi.deleteBatch(batchId);
      flashSaved();
      if (viewBatch?.id === batchId) setViewBatch(null);
      handleList();
    } catch (err) { setError(err.message); }
  }

  function flashSaved() {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }

  // ─── Uncleared batches for "add to existing" dropdown ──────────────────
  const unclearedBatches = batches.filter((b) => b.cleared_count < b.txn_count || b.txn_count === 0);

  const links = [{ label: 'Home', to: '/' }];
  const canCreate = can('finance_batches', 'create');
  const canDelete = can('finance_batches', 'delete');

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={links} current="Credit Batches" />

      <div className="max-w-5xl mx-auto px-4 mt-4">
        <h1 className="text-xl font-bold mb-4">Credit Batches</h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
            Done.
          </div>
        )}

        {/* ─── Account selector & filter ───────────────────────────────── */}
        {!viewBatch && !showCreate && (
          <form onSubmit={handleList} className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
              <select name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
                <option value="">— select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Show</label>
              <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                <option value="uncleared">Uncleared</option>
                <option value="since">Since date</option>
              </select>
            </div>
            {mode === 'since' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Since</label>
                <input type="date" name="sinceDate" value={sinceDate} onChange={(e) => setSinceDate(e.target.value)} className={inputCls} />
              </div>
            )}
            <button type="submit" disabled={!accountId || loading} className={btnPrimary}>
              {loading ? 'Loading...' : 'Show'}
            </button>
            {canCreate && (
              <button type="button" onClick={openCreate} disabled={!accountId} className={btnPrimary}>
                Add credit batch
              </button>
            )}
          </form>
        )}

        {/* ─── Batch list ──────────────────────────────────────────────── */}
        {!viewBatch && !showCreate && batches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm border border-slate-300">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-1 border-b border-slate-300 text-left">Batch Ref</th>
                  <th className="px-3 py-1 border-b border-slate-300 text-left">Created</th>
                  <th className="px-3 py-1 border-b border-slate-300 text-right">Transactions</th>
                  <th className="px-3 py-1 border-b border-slate-300 text-right">Total (£)</th>
                  <th className="px-3 py-1 border-b border-slate-300 text-left">Status</th>
                  <th className="px-3 py-1 border-b border-slate-300" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b, i) => {
                  const allCleared = b.cleared_count === b.txn_count && b.txn_count > 0;
                  const partCleared = b.cleared_count > 0 && b.cleared_count < b.txn_count;
                  return (
                    <tr key={b.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-3 py-1 border-b border-slate-200">
                        <button onClick={() => openBatch(b.id)} className="text-blue-700 hover:underline font-medium">
                          {b.batch_ref}
                        </button>
                      </td>
                      <td className="px-3 py-1 border-b border-slate-200">{fmtDate(b.created_at)}</td>
                      <td className="px-3 py-1 border-b border-slate-200 text-right">{b.txn_count}</td>
                      <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">{fmtAmt(b.total_amount)}</td>
                      <td className="px-3 py-1 border-b border-slate-200">
                        {allCleared ? (
                          <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Cleared</span>
                        ) : partCleared ? (
                          <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Part cleared</span>
                        ) : (
                          <span className="text-xs text-slate-500">Uncleared</span>
                        )}
                      </td>
                      <td className="px-3 py-1 border-b border-slate-200">
                        {canDelete && b.txn_count === 0 && (
                          <button onClick={() => handleDeleteBatch(b.id)} className="text-red-600 hover:underline text-xs">
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!viewBatch && !showCreate && !loading && batches.length === 0 && accountId && (
          <p className="text-sm text-slate-500">No batches found.</p>
        )}

        {/* ─── Batch detail view ───────────────────────────────────────── */}
        {viewBatch && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => { setViewBatch(null); handleList(); }} className={btnSecondary}>
                &larr; Back to list
              </button>
              <h2 className="text-lg font-bold">Batch: {viewBatch.batch_ref}</h2>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="min-w-max w-full text-sm border border-slate-300">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-2 py-1 border-b border-slate-300 w-8" />
                    <th className="px-3 py-1 border-b border-slate-300 text-left">#</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Date</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">From/To</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Detail</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-right">Amount (£)</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Cleared</th>
                  </tr>
                </thead>
                <tbody>
                  {viewBatch.transactions.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-3 text-center text-slate-400">No transactions in this batch.</td></tr>
                  ) : viewBatch.transactions.map((t, i) => (
                    <tr key={t.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-2 py-1 border-b border-slate-200 text-center">
                        {!t.cleared_at && (
                          <input
                            type="checkbox"
                            checked={selectedRemove.has(t.id)}
                            onChange={() => toggleRemove(t.id)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-1 border-b border-slate-200 font-mono text-xs text-slate-500">{t.transaction_number}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{fmtDate(t.date)}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{t.from_to ?? ''}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{t.detail ?? ''}</td>
                      <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">{fmtAmt(t.amount)}</td>
                      <td className="px-3 py-1 border-b border-slate-200">
                        {t.cleared_at ? fmtDate(t.cleared_at) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {viewBatch.transactions.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-medium">
                      <td colSpan={5} className="px-3 py-1 border-t border-slate-300 text-right">Total:</td>
                      <td className="px-3 py-1 border-t border-slate-300 text-right font-mono">
                        {fmtAmt(viewBatch.transactions.reduce((s, t) => s + t.amount, 0))}
                      </td>
                      <td className="border-t border-slate-300" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {canCreate && selectedRemove.size > 0 && (
              <button
                onClick={handleRemoveFromBatch}
                disabled={removing}
                className={btnDanger}
              >
                {removing ? 'Removing...' : `Remove ${selectedRemove.size} transaction(s) from batch`}
              </button>
            )}

            {canDelete && viewBatch.transactions.length === 0 && (
              <button onClick={() => handleDeleteBatch(viewBatch.id)} className={`${btnDanger} ml-3`}>
                Delete batch
              </button>
            )}
          </div>
        )}

        {/* ─── Create / add to batch ───────────────────────────────────── */}
        {showCreate && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => setShowCreate(false)} className={btnSecondary}>
                &larr; Back
              </button>
              <h2 className="text-lg font-bold">Select transactions for batch</h2>
            </div>

            {loadingUnbatched ? (
              <p className="text-sm text-slate-500">Loading unbatched transactions...</p>
            ) : unbatched.length === 0 ? (
              <p className="text-sm text-slate-500">No unbatched credit transactions available.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 mb-3 items-center">
                  <button onClick={() => setSelectedCreate(new Set(unbatched.map((t) => t.id)))} className="text-blue-700 hover:underline text-sm">Select All</button>
                  <button onClick={() => setSelectedCreate(new Set())} className="text-blue-700 hover:underline text-sm">Clear</button>
                  <span className="text-sm text-slate-500">{selectedCreate.size} selected</span>
                </div>

                <div className="overflow-x-auto mb-4">
                  <table className="min-w-max w-full text-sm border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-2 py-1 border-b border-slate-300 w-8">
                          <input
                            type="checkbox"
                            checked={selectedCreate.size === unbatched.length && unbatched.length > 0}
                            onChange={() => selectedCreate.size === unbatched.length ? setSelectedCreate(new Set()) : setSelectedCreate(new Set(unbatched.map((t) => t.id)))}
                          />
                        </th>
                        <th className="px-3 py-1 border-b border-slate-300 text-left">#</th>
                        <th className="px-3 py-1 border-b border-slate-300 text-left">Date</th>
                        <th className="px-3 py-1 border-b border-slate-300 text-left">From/To</th>
                        <th className="px-3 py-1 border-b border-slate-300 text-left">Detail</th>
                        <th className="px-3 py-1 border-b border-slate-300 text-left">Method</th>
                        <th className="px-3 py-1 border-b border-slate-300 text-left">Ref</th>
                        <th className="px-3 py-1 border-b border-slate-300 text-right">Amount (£)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unbatched.map((t, i) => (
                        <tr
                          key={t.id}
                          className={`cursor-pointer ${selectedCreate.has(t.id) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                          onClick={() => toggleCreate(t.id)}
                        >
                          <td className="px-2 py-1 border-b border-slate-200 text-center">
                            <input type="checkbox" checked={selectedCreate.has(t.id)} readOnly />
                          </td>
                          <td className="px-3 py-1 border-b border-slate-200 font-mono text-xs text-slate-500">{t.transaction_number}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{fmtDate(t.date)}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{t.from_to ?? ''}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{t.detail ?? ''}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{t.payment_method ?? ''}</td>
                          <td className="px-3 py-1 border-b border-slate-200">{t.payment_ref ?? ''}</td>
                          <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">{fmtAmt(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {selectedCreate.size > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 font-medium">
                          <td colSpan={7} className="px-3 py-1 border-t border-slate-300 text-right">Selected total:</td>
                          <td className="px-3 py-1 border-t border-slate-300 text-right font-mono">
                            {fmtAmt(unbatched.filter((t) => selectedCreate.has(t.id)).reduce((s, t) => s + t.amount, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {selectedCreate.size > 0 && (
                  <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-4">
                    {/* Create new batch */}
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Batch Reference</label>
                        <input
                          type="text"
                          name="batchRef"
                          value={batchRef}
                          onChange={(e) => setBatchRef(e.target.value)}
                          placeholder="e.g. 12 Mar 2026"
                          className={inputCls}
                        />
                      </div>
                      <button
                        onClick={handleCreateBatch}
                        disabled={creating || !batchRef.trim()}
                        className={btnPrimary}
                      >
                        {creating ? 'Creating...' : 'Create Batch'}
                      </button>
                    </div>

                    {/* Add to existing batch */}
                    {unclearedBatches.length > 0 && (
                      <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Or add to existing batch</label>
                          <select
                            name="existingBatchId"
                            value={existingBatchId}
                            onChange={(e) => setExistingBatchId(e.target.value)}
                            className={inputCls}
                          >
                            <option value="">— select batch —</option>
                            {unclearedBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batch_ref} ({b.txn_count} txns, £{fmtAmt(b.total_amount)})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={handleAddToExisting}
                          disabled={creating || !existingBatchId}
                          className={btnPrimary}
                        >
                          Add to Existing
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
