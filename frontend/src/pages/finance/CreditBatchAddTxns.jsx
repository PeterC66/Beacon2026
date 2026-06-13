// beacon2/frontend/src/pages/finance/CreditBatchAddTxns.jsx
//
// "Add transactions to an existing batch" view of CreditBatches. Presentation
// only: state and handlers are owned by the parent; the selection table is the
// shared CreditBatchPicker.

import { btnPrimary, btnSecondary } from './creditBatchesUtils.js';
import CreditBatchPicker from './CreditBatchPicker.jsx';

export default function CreditBatchAddTxns({
  viewBatch,
  setShowAddTxns,
  loadingAddTxns,
  addUnbatched,
  selectedAdd,
  setSelectedAdd,
  toggleAdd,
  addingTxns,
  handleAddTxnsToBatch,
}) {
  return (
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
          <CreditBatchPicker
            rows={addUnbatched}
            selected={selectedAdd}
            setSelected={setSelectedAdd}
            toggle={toggleAdd}
          />

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
  );
}
