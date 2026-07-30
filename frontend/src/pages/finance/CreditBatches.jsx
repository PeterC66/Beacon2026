// beacon2026/frontend/src/pages/finance/CreditBatches.jsx
// Credit Batches — list, view, create, add/remove transactions (doc 7.4).

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { toISODate } from './creditBatchesUtils.js';
import CreditBatchList from './CreditBatchList.jsx';
import CreditBatchDetail from './CreditBatchDetail.jsx';
import CreditBatchAddTxns from './CreditBatchAddTxns.jsx';
import CreditBatchCreate from './CreditBatchCreate.jsx';

export default function CreditBatches() {
  const { can, tenant } = useAuth();
  const [searchParams] = useSearchParams();
  const initialBatchId = searchParams.get('batchId') ?? '';

  // ─── List mode state ────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [mode, setMode] = useState('uncleared'); // uncleared | since
  const [sinceDate, setSinceDate] = useState('');
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Detail mode state ──────────────────────────────────────────────────
  const [viewBatch, setViewBatch] = useState(null);
  const [editRef, setEditRef] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Create/Add mode state ──────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [unbatched, setUnbatched] = useState([]);
  const [selectedCreate, setSelectedCreate] = useState(new Set());
  const [batchRef, setBatchRef] = useState('');
  const [batchDesc, setBatchDesc] = useState('');
  const [existingBatchId, setExistingBatchId] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingUnbatched, setLoadingUnbatched] = useState(false);

  // ─── Add-to-batch from detail view ─────────────────────────────────────
  const [showAddTxns, setShowAddTxns] = useState(false);
  const [addUnbatched, setAddUnbatched] = useState([]);
  const [selectedAdd, setSelectedAdd] = useState(new Set());
  const [loadingAddTxns, setLoadingAddTxns] = useState(false);
  const [addingTxns, setAddingTxns] = useState(false);

  // ─── Remove mode state ──────────────────────────────────────────────────
  const [selectedRemove, setSelectedRemove] = useState(new Set());
  const [removing, setRemoving] = useState(false);

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
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Auto-open a specific batch if batchId query param is present
  useEffect(() => {
    if (initialBatchId) openBatch(initialBatchId);
  }, [initialBatchId]);

  // ─── Auto-load batches when account/mode/date changes ─────────────────
  const loadBatches = useCallback(async () => {
    if (!accountId) {
      setBatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = { accountId, mode };
      if (mode === 'since' && sinceDate) params.date = sinceDate;
      const rows = await financeApi.listBatches(params);
      setBatches(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBatchDetails() {
    if (!viewBatch) return;
    if (!editRef.trim()) {
      setError('Batch reference is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updates = {};
      if (editRef.trim() !== viewBatch.batch_ref) updates.batch_ref = editRef.trim();
      if ((editDesc || null) !== (viewBatch.description || null))
        updates.description = editDesc.trim() || null;
      if (editDate !== toISODate(viewBatch.batch_date)) updates.batch_date = editDate;

      if (Object.keys(updates).length > 0) {
        const updated = await financeApi.updateBatch(viewBatch.id, updates);
        setViewBatch((prev) => ({ ...prev, ...updated }));
        flashSaved();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Create / add to batch ─────────────────────────────────────────────

  async function openCreate() {
    if (!accountId) {
      setError('Select an account first.');
      return;
    }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingUnbatched(false);
    }
  }

  function toggleCreate(id) {
    setSelectedCreate((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateBatch() {
    if (selectedCreate.size === 0) return;
    if (!batchRef.trim()) {
      setError('Enter a batch reference.');
      return;
    }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddToExisting() {
    if (selectedCreate.size === 0 || !existingBatchId) return;
    setCreating(true);
    setError(null);
    try {
      await financeApi.addToBatch(existingBatchId, [...selectedCreate]);
      flashSaved();
      setShowCreate(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAddTxns(false);
    }
  }

  function toggleAdd(id) {
    setSelectedAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingTxns(false);
    }
  }

  // ─── Remove transactions from batch ────────────────────────────────────

  function toggleRemove(id) {
    setSelectedRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  // ─── Delete batch ──────────────────────────────────────────────────────

  async function handleDeleteBatch(batchId) {
    if (!confirm('Delete this empty batch?')) return;
    setError(null);
    try {
      await financeApi.deleteBatch(batchId);
      flashSaved();
      if (viewBatch?.id === batchId) setViewBatch(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function flashSaved() {
    setSaved(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }

  // ─── Derived ──────────────────────────────────────────────────────────
  const unclearedBatches = batches.filter(
    (b) => b.cleared_count < b.txn_count || b.txn_count === 0,
  );
  const canCreate = can('finance_batches', 'create');
  const canDelete = can('finance_batches', 'delete');

  // Batch detail — totals for remove pattern
  const currentBatchTotal = viewBatch
    ? viewBatch.transactions.reduce((s, t) => s + t.amount, 0)
    : 0;
  const newBatchTotal = viewBatch
    ? viewBatch.transactions
        .filter((t) => !selectedRemove.has(t.id))
        .reduce((s, t) => s + t.amount, 0)
    : 0;
  const hasRemovable = viewBatch ? viewBatch.transactions.some((t) => !t.cleared_at) : false;

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

        {/* ─── List view (filter bar + batch table) ────────────────────── */}
        {!viewBatch && !showCreate && (
          <CreditBatchList
            accounts={accounts}
            accountId={accountId}
            setAccountId={setAccountId}
            mode={mode}
            setMode={setMode}
            sinceDate={sinceDate}
            setSinceDate={setSinceDate}
            loading={loading}
            batches={batches}
            canDelete={canDelete}
            openBatch={openBatch}
            handleDeleteBatch={handleDeleteBatch}
          />
        )}

        {/* ─── Batch detail view ───────────────────────────────────────── */}
        {viewBatch && !showAddTxns && (
          <CreditBatchDetail
            viewBatch={viewBatch}
            setViewBatch={setViewBatch}
            canCreate={canCreate}
            canDelete={canDelete}
            editRef={editRef}
            setEditRef={setEditRef}
            editDate={editDate}
            setEditDate={setEditDate}
            editDesc={editDesc}
            setEditDesc={setEditDesc}
            saving={saving}
            handleSaveBatchDetails={handleSaveBatchDetails}
            selectedRemove={selectedRemove}
            setSelectedRemove={setSelectedRemove}
            toggleRemove={toggleRemove}
            removing={removing}
            handleRemoveFromBatch={handleRemoveFromBatch}
            openAddTxns={openAddTxns}
            handleDeleteBatch={handleDeleteBatch}
            currentBatchTotal={currentBatchTotal}
            newBatchTotal={newBatchTotal}
            hasRemovable={hasRemovable}
          />
        )}

        {/* ─── Add transactions to existing batch (from detail view) ──── */}
        {viewBatch && showAddTxns && (
          <CreditBatchAddTxns
            viewBatch={viewBatch}
            setShowAddTxns={setShowAddTxns}
            loadingAddTxns={loadingAddTxns}
            addUnbatched={addUnbatched}
            selectedAdd={selectedAdd}
            setSelectedAdd={setSelectedAdd}
            toggleAdd={toggleAdd}
            addingTxns={addingTxns}
            handleAddTxnsToBatch={handleAddTxnsToBatch}
          />
        )}

        {/* ─── Create new batch ────────────────────────────────────────── */}
        {showCreate && (
          <CreditBatchCreate
            setShowCreate={setShowCreate}
            loadingUnbatched={loadingUnbatched}
            unbatched={unbatched}
            selectedCreate={selectedCreate}
            setSelectedCreate={setSelectedCreate}
            toggleCreate={toggleCreate}
            batchRef={batchRef}
            setBatchRef={setBatchRef}
            batchDesc={batchDesc}
            setBatchDesc={setBatchDesc}
            creating={creating}
            handleCreateBatch={handleCreateBatch}
            unclearedBatches={unclearedBatches}
            existingBatchId={existingBatchId}
            setExistingBatchId={setExistingBatchId}
            handleAddToExisting={handleAddToExisting}
          />
        )}
      </div>
    </div>
  );
}
