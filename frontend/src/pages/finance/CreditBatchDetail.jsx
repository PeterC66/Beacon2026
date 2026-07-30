// beacon2026/frontend/src/pages/finance/CreditBatchDetail.jsx
//
// Batch detail/edit view of CreditBatches — editable header, the batch's
// transaction table with optional "remove?" column, and the action buttons.
// Presentation only: all state and handlers are owned by the parent.

import { inputCls, btnPrimary, btnDanger, btnSecondary, fmtAmt } from './creditBatchesUtils.js';
import { fmtDate } from '../../lib/dateFormatters.js';

export default function CreditBatchDetail({
  viewBatch,
  setViewBatch,
  canCreate,
  canDelete,
  editRef,
  setEditRef,
  editDate,
  setEditDate,
  editDesc,
  setEditDesc,
  saving,
  handleSaveBatchDetails,
  selectedRemove,
  setSelectedRemove,
  toggleRemove,
  removing,
  handleRemoveFromBatch,
  openAddTxns,
  handleDeleteBatch,
  currentBatchTotal,
  newBatchTotal,
  hasRemovable,
}) {
  return (
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Batch Reference
              </label>
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
            <button
              onClick={handleSaveBatchDetails}
              disabled={saving || !editRef.trim()}
              className={btnPrimary}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            <span>
              <span className="font-medium">Reference:</span> {viewBatch.batch_ref}
            </span>
            <span>
              <span className="font-medium">Date:</span> {fmtDate(viewBatch.batch_date)}
            </span>
            {viewBatch.description && (
              <span>
                <span className="font-medium">Description:</span> {viewBatch.description}
              </span>
            )}
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
              <tr>
                <td
                  colSpan={hasRemovable && canCreate ? 9 : 8}
                  className="px-3 py-3 text-center text-slate-400"
                >
                  No transactions in this batch.
                </td>
              </tr>
            ) : (
              viewBatch.transactions.map((t, i) => (
                <tr
                  key={t.id}
                  className={
                    selectedRemove.has(t.id)
                      ? 'bg-red-50'
                      : i % 2 === 0
                        ? 'bg-yellow-50'
                        : 'bg-white'
                  }
                >
                  <td className="px-3 py-1 border-b border-slate-200 font-mono text-xs text-slate-500">
                    {t.transaction_number}
                  </td>
                  <td className="px-3 py-1 border-b border-slate-200">{fmtDate(t.date)}</td>
                  <td className="px-3 py-1 border-b border-slate-200">{t.payment_ref ?? ''}</td>
                  <td className="px-3 py-1 border-b border-slate-200">{t.payment_method ?? ''}</td>
                  <td className="px-3 py-1 border-b border-slate-200">{t.from_to ?? ''}</td>
                  <td className="px-3 py-1 border-b border-slate-200">{t.detail ?? ''}</td>
                  <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">
                    {fmtAmt(t.amount)}
                  </td>
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
              ))
            )}
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
  );
}
