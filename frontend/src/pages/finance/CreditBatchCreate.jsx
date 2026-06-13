// beacon2/frontend/src/pages/finance/CreditBatchCreate.jsx
//
// "Create a new batch / add selection to an existing batch" view of
// CreditBatches. Presentation only: state and handlers are owned by the parent;
// the selection table is the shared CreditBatchPicker.

import { inputCls, btnPrimary, btnSecondary, fmtAmt } from './creditBatchesUtils.js';
import CreditBatchPicker from './CreditBatchPicker.jsx';

export default function CreditBatchCreate({
  setShowCreate,
  loadingUnbatched,
  unbatched,
  selectedCreate,
  setSelectedCreate,
  toggleCreate,
  batchRef,
  setBatchRef,
  batchDesc,
  setBatchDesc,
  creating,
  handleCreateBatch,
  unclearedBatches,
  existingBatchId,
  setExistingBatchId,
  handleAddToExisting,
}) {
  return (
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
          <CreditBatchPicker
            rows={unbatched}
            selected={selectedCreate}
            setSelected={setSelectedCreate}
            toggle={toggleCreate}
          />

          {selectedCreate.size > 0 && (
            <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-4">
              {/* Create new batch */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Batch Reference
                  </label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Or add to existing batch
                    </label>
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
  );
}
