// beacon2/frontend/src/pages/finance/CreditBatchList.jsx
//
// List view of CreditBatches — account/mode/date filter bar and the batch table.
// Presentation only: filter state and handlers are owned by the parent.

import { inputCls, fmtAmt } from './creditBatchesUtils.js';
import { fmtDate } from '../../lib/dateFormatters.js';

export default function CreditBatchList({
  accounts,
  accountId,
  setAccountId,
  mode,
  setMode,
  sinceDate,
  setSinceDate,
  loading,
  batches,
  canDelete,
  openBatch,
  handleDeleteBatch,
}) {
  return (
    <>
      {/* Account selector & filter */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
          <select
            name="accountId"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputCls}
          >
            <option value="">— select —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Show</label>
          <select
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={inputCls}
          >
            <option value="uncleared">Uncleared</option>
            <option value="since">Since date</option>
          </select>
        </div>
        {mode === 'since' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Since</label>
            <input
              type="date"
              name="sinceDate"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Batch list */}
      {loading && <p className="text-center text-slate-500 py-8">Loading…</p>}

      {!loading && batches.length > 0 && (
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
                      <button
                        onClick={() => openBatch(b.id)}
                        className="text-blue-700 hover:underline font-medium"
                      >
                        {b.batch_ref}
                      </button>
                    </td>
                    <td className="px-3 py-1 border-b border-slate-200">{fmtDate(b.batch_date)}</td>
                    <td className="px-3 py-1 border-b border-slate-200 text-right">
                      {b.txn_count}
                    </td>
                    <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">
                      {fmtAmt(b.total_amount)}
                    </td>
                    <td className="px-3 py-1 border-b border-slate-200">
                      {allCleared ? (
                        <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                          Cleared
                        </span>
                      ) : partCleared ? (
                        <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Part cleared
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Uncleared</span>
                      )}
                    </td>
                    <td className="px-3 py-1 border-b border-slate-200">
                      {canDelete && b.txn_count === 0 && (
                        <button
                          onClick={() => handleDeleteBatch(b.id)}
                          className="text-red-600 hover:underline text-xs"
                        >
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

      {!loading && batches.length === 0 && accountId && (
        <p className="text-sm text-slate-500">No batches found.</p>
      )}
    </>
  );
}
