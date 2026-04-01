// beacon2/frontend/src/pages/finance/CreditBatches.jsx
// Credit Batches — list, view, create, add/remove transactions (doc 7.4).

import { useState, useEffect, useCallback, useRef } from 'react';
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

function toISODate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

export default function CreditBatches() {
  const { can, tenant } = useAuth();
  const [searchParams] = useSearchParams();
  const initialBatchId = searchParams.get('batchId') ?? '';

  // ─── List mode state ────────────────────────────────────────────────────
  const [accounts,  setAccounts]  = useState([]);
  const [accountId, setAccountId] = useState('');
  const [mode,      setMode]      = useState('uncleared'); // uncleared | since
  const [sinceDate, setSinceDate] = useState('');
  const [batches,   setBatches]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // ─── Detail mode state ──────────────────────────────────────────────────
  const [viewBatch, setViewBatch] = useState(null);
  const [editRef,   setEditRef]   = useState('');
  const [editDesc,  setEditDesc]  = useState('');
  const [editDate,  setEditDate]  = useState('');
  const [saving,    setSaving]    = useState(false);

  // ─── Create/Add mode state ──────────────────────────────────────────────
  const [showCreate,      setShowCreate]      = useState(false);
  const [unbatched,       setUnbatched]       = useState([]);
  const [selectedCreate,  setSelectedCreate]  = useState(new Set());
  const [batchRef,        setBatchRef]        = useState('');
  const [batchDesc,       setBatchDesc]       = useState('');
  const [existingBatchId, setExistingBatchId] = useState('');
  const [creating,        setCreating]        = useState(false);
  const [loadingUnbatched, setLoadingUnbatched] = useState(false);

  // ─── Add-to-batch from detail view ─────────────────────────────────────
  const [showAddTxns,      setShowAddTxns]      = useState(false);
  const [addUnbatched,     setAddUnbatched]     = useState([]);
  const [selectedAdd,      setSelectedAdd]      = useState(new Set());
  const [loadingAddTxns,   setLoadingAddTxns]   = useState(false);
  const [addingTxns,       setAddingTxns]       = useState(false);

  // ─── Remove mode state ──────────────────────────────────────────────────
  const [selectedRemove, setSelectedRemove] = useState(new Set());
  const [removing,       setRemoving]       = useState(false);

  // ─── Feedback ───────────────────────────────────────────────────────────
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  // ─── Load accounts and auto-select first locked ────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const accs = await financeApi.listAccounts();
        const active = accs.filter((a) => a.active);
        setAccounts(active);
        const firstLocked = active.find((a) => a.locked);
        if (firstLocked) setAccountId(firstLocked.id);
        else if (active.length > 0) setAccountId(active[0].id);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    init();
  }, []);

  // Auto-open a specific batch if batchId query param is present
  useEffect(() => {
    if (initialBatchId) openBatch(initialBatchId);
  }, [initialBatchId]);

  // ─── Auto-load batches when account/mode/date changes ─────────────────
  const loadBatches = useCallback(async () => {
    if (!accountId) { setBatches([]); return; }
    setLoading(true);
    setError(null);
    try {
      const params = { accountId, mode };
      if (mode === 'since' && sinceDate) params.date = sinceDate;
      const rows = await financeApi.listBatches(params);
      setBatches(rows);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [accountId, mode, sinceDate]);

  useEffect(() => {
    if (!viewBatch && !showCreate && accountId) loadBatches();
  }, [loadBatches, viewBatch, showCreate, accountId]);

  // ─── View batch detail ──────────────────────────────────────────────────

  async function openBatch(batchId) {
    setLoading(true);
    setError(null);
    setShowAddTxns(false);
    try {
      const detail = await financeApi.getBatch(batchId);
      setViewBatch(detail);
      setEditRef(detail.batch_ref);
      setEditDesc(detail.description ?? '');
      setEditDate(toISODate(detail.batch_date));
      setSelectedRemove(new Set());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSaveBatchDetails() {
    if (!viewBatch) return;
    if (!editRef.trim()) { setError('Batch reference is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const updates = {};
      if (editRef.trim() !== viewBatch.batch_ref) updates.batch_ref = editRef.trim();
      if ((editDesc || null) !== (viewBatch.description || null)) updates.description = editDesc.trim() || null;
      if (editDate !== toISODate(viewBatch.batch_date)) updates.batch_date = editDate;

      if (Object.keys(updates).length > 0) {
        const updated = await financeApi.updateBatch(viewBatch.id, updates);
        setViewBatch((prev) => ({ ...prev, ...updated }));
        flashSaved();
      }
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
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
      setBatchDesc('');
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
        description: batchDesc.trim() || null,
        transactionIds: [...selectedCreate],
      });
      flashSaved();
      setShowCreate(false);
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
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  // ─── Add transactions from batch detail view ──────────────────────────

  async function openAddTxns() {
    if (!viewBatch) return;
    setShowAddTxns(true);
    setLoadingAddTxns(true);
    setError(null);
    try {
      const rows = await financeApi.getUnbatched(viewBatch.account_id);
      setAddUnbatched(rows);
      setSelectedAdd(new Set());
    } catch (err) { setError(err.message); }
    finally { setLoadingAddTxns(false); }
  }

  function toggleAdd(id) {
    setSelectedAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAddTxnsToBatch() {
    if (!viewBatch || selectedAdd.size === 0) return;
    setAddingTxns(true);
    setError(null);
    try {
      await financeApi.addToBatch(viewBatch.id, [...selectedAdd]);
      flashSaved();
      setShowAddTxns(false);
      await openBatch(viewBatch.id);
    } catch (err) { setError(err.message); }
    finally { setAddingTxns(false); }
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
    } catch (err) { setError(err.message); }
  }

  function flashSaved() {
    setSaved(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }

  // ─── Derived ──────────────────────────────────────────────────────────
  const unclearedBatches = batches.filter((b) => b.cleared_count < b.txn_count || b.txn_count === 0);
  const canCreate = can('finance_batches', 'create');
  const canDelete = can('finance_batches', 'delete');

  // Batch detail — totals for remove pattern
  const currentBatchTotal = viewBatch ? viewBatch.transactions.reduce((s, t) => s + t.amount, 0) : 0;
  const newBatchTotal     = viewBatch ? viewBatch.transactions.filter((t) => !selectedRemove.has(t.id)).reduce((s, t) => s + t.amount, 0) : 0;
  const hasRemovable      = viewBatch ? viewBatch.transactions.some((t) => !t.cleared_at) : false;

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(canCreate ? [{ label: 'Add credit batch', onClick: openCreate }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} current="Credit Batches" />

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
          <div className="flex flex-wrap items-end gap-4 mb-4">
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
          </div>
        )}

        {/* ─── Batch list ──────────────────────────────────────────────── */}
        {!viewBatch && !showCreate && loading && (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        )}

        {!viewBatch && !showCreate && !loading && batches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm border border-slate-300">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-1 border-b border-slate-300 text-left">Batch Ref</th>
                  <th className="px-3 py-1 border-b border-slate-300 text-left">Batch Date</th>
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
                      <td className="px-3 py-1 border-b border-slate-200">{fmtDate(b.batch_date)}</td>
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
        {viewBatch && !showAddTxns && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => setViewBatch(null)} className={btnSecondary}>
                &larr; Back to list
              </button>
              <h2 className="text-lg font-bold">Edit Credit Batch</h2>
            </div>

            {/* Batch details */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-4 space-y-3">
              <div className="flex flex-wrap items-end gap-4">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Batch Number:</span> {viewBatch.batch_number}
                </div>
              </div>
              {canCreate ? (
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Batch Reference</label>
                    <input
                      type="text"
                      name="editRef"
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Batch Date</label>
                    <input
                      type="date"
                      name="editDate"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      name="editDesc"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Optional"
                      className={`${inputCls} w-full`}
                    />
                  </div>
                  <button onClick={handleSaveBatchDetails} disabled={saving || !editRef.trim()} className={btnPrimary}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                  <span><span className="font-medium">Reference:</span> {viewBatch.batch_ref}</span>
                  <span><span className="font-medium">Date:</span> {fmtDate(viewBatch.batch_date)}</span>
                  {viewBatch.description && <span><span className="font-medium">Description:</span> {viewBatch.description}</span>}
                </div>
              )}
            </div>

            {/* Batch transactions table */}
            <div className="overflow-x-auto mb-4">
              <table className="min-w-max w-full text-sm border border-slate-300">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-1 border-b border-slate-300 text-left">#</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Date</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Payment Ref</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Payment Method</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">From/To</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Detail</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-right">Amount (£)</th>
                    <th className="px-3 py-1 border-b border-slate-300 text-left">Cleared</th>
                    {hasRemovable && canCreate && (
                      <th className="px-3 py-1 border-b border-slate-300 text-center">Remove?</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {viewBatch.transactions.length === 0 ? (
                    <tr><td colSpan={hasRemovable && canCreate ? 9 : 8} className="px-3 py-3 text-center text-slate-400">No transactions in this batch.</td></tr>
                  ) : viewBatch.transactions.map((t, i) => (
                    <tr key={t.id} className={selectedRemove.has(t.id) ? 'bg-red-50' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-3 py-1 border-b border-slate-200 font-mono text-xs text-slate-500">{t.transaction_number}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{fmtDate(t.date)}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{t.payment_ref ?? ''}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{t.payment_method ?? ''}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{t.from_to ?? ''}</td>
                      <td className="px-3 py-1 border-b border-slate-200">{t.detail ?? ''}</td>
                      <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">{fmtAmt(t.amount)}</td>
                      <td className="px-3 py-1 border-b border-slate-200">
                        {t.cleared_at ? fmtDate(t.cleared_at) : ''}
                      </td>
                      {hasRemovable && canCreate && (
                        <td className="px-2 py-1 border-b border-slate-200 text-center">
                          {!t.cleared_at && (
                            <input
                              type="checkbox"
                              checked={selectedRemove.has(t.id)}
                              onChange={() => toggleRemove(t.id)}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {viewBatch.transactions.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan={6} className="px-3 py-1.5 text-right font-medium text-sm">
                        Current Batch Total:
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                        £{fmtAmt(currentBatchTotal)}
                      </td>
                      <td colSpan={hasRemovable && canCreate ? 2 : 1} />
                    </tr>
                    {selectedRemove.size > 0 && (
                      <tr className="bg-slate-100">
                        <td colSpan={6} className="px-3 py-1.5 text-right font-medium text-sm">
                          New Batch Total:
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">
                          £{fmtAmt(newBatchTotal)}
                        </td>
                        <td colSpan={hasRemovable && canCreate ? 2 : 1} />
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>

            {/* Action buttons below the table */}
            <div className="flex flex-wrap gap-3">
              {canCreate && hasRemovable && (
                <>
                  <button
                    onClick={handleRemoveFromBatch}
                    disabled={removing || selectedRemove.size === 0}
                    className={btnPrimary}
                  >
                    {removing ? 'Removing…' : 'Update Transaction'}
                  </button>
                  <button
                    onClick={() => setSelectedRemove(new Set())}
                    disabled={removing || selectedRemove.size === 0}
                    className={btnSecondary}
                  >
                    Cancel
                  </button>
                </>
              )}
              {canCreate && (
                <button onClick={openAddTxns} className={btnPrimary}>
                  Add transactions
                </button>
              )}
              {canDelete && viewBatch.transactions.length === 0 && (
                <button onClick={() => handleDeleteBatch(viewBatch.id)} className={btnDanger}>
                  Delete batch
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Add transactions to existing batch (from detail view) ──── */}
        {viewBatch && showAddTxns && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => setShowAddTxns(false)} className={btnSecondary}>
                &larr; Back to batch
              </button>
              <h2 className="text-lg font-bold">Add transactions to: {viewBatch.batch_ref}</h2>
            </div>

            {loadingAddTxns ? (
              <p className="text-center text-slate-500 py-8">Loading unbatched transactions…</p>
            ) : addUnbatched.length === 0 ? (
              <p className="text-sm text-slate-500">No unbatched credit transactions available.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 mb-3 items-center">
                  <button onClick={() => setSelectedAdd(new Set(addUnbatched.map((t) => t.id)))} className="text-blue-700 hover:underline text-sm">Select All</button>
                  <button onClick={() => setSelectedAdd(new Set())} className="text-blue-700 hover:underline text-sm">Clear</button>
                  <span className="text-sm text-slate-500">{selectedAdd.size} selected</span>
                </div>

                <div className="overflow-x-auto mb-4">
                  <table className="min-w-max w-full text-sm border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-2 py-1 border-b border-slate-300 w-8">
                          <input
                            type="checkbox"
                            checked={selectedAdd.size === addUnbatched.length && addUnbatched.length > 0}
                            onChange={() => selectedAdd.size === addUnbatched.length ? setSelectedAdd(new Set()) : setSelectedAdd(new Set(addUnbatched.map((t) => t.id)))}
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
                      {addUnbatched.map((t, i) => (
                        <tr
                          key={t.id}
                          className={`cursor-pointer ${selectedAdd.has(t.id) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                          onClick={() => toggleAdd(t.id)}
                        >
                          <td className="px-2 py-1 border-b border-slate-200 text-center">
                            <input type="checkbox" checked={selectedAdd.has(t.id)} readOnly />
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
                    {selectedAdd.size > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 font-medium">
                          <td colSpan={7} className="px-3 py-1 border-t border-slate-300 text-right">Selected total:</td>
                          <td className="px-3 py-1 border-t border-slate-300 text-right font-mono">
                            {fmtAmt(addUnbatched.filter((t) => selectedAdd.has(t.id)).reduce((s, t) => s + t.amount, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddTxnsToBatch}
                    disabled={addingTxns || selectedAdd.size === 0}
                    className={btnPrimary}
                  >
                    {addingTxns ? 'Adding…' : `Add ${selectedAdd.size} to batch`}
                  </button>
                  <button onClick={() => setShowAddTxns(false)} className={btnSecondary}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Create new batch ────────────────────────────────────────── */}
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
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                        <input
                          type="text"
                          name="batchDesc"
                          value={batchDesc}
                          onChange={(e) => setBatchDesc(e.target.value)}
                          placeholder="Optional description"
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
