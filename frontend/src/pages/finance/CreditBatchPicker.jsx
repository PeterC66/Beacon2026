// beacon2026/frontend/src/pages/finance/CreditBatchPicker.jsx
//
// Shared "select unbatched credit transactions" table, used both when creating a
// new batch and when adding transactions to an existing one. Presentation only:
// the row list and selection Set are owned by the parent.

import { fmtAmt } from './creditBatchesUtils.js';
import { fmtDate } from '../../lib/dateFormatters.js';

export default function CreditBatchPicker({ rows, selected, setSelected, toggle }) {
  const allSelected = selected.size === rows.length && rows.length > 0;
  const selectAllOrNone = () =>
    selected.size === rows.length
      ? setSelected(new Set())
      : setSelected(new Set(rows.map((t) => t.id)));

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-3 items-center">
        <button
          onClick={() => setSelected(new Set(rows.map((t) => t.id)))}
          className="text-blue-700 hover:underline text-sm"
        >
          Select All
        </button>
        <button
          onClick={() => setSelected(new Set())}
          className="text-blue-700 hover:underline text-sm"
        >
          Clear
        </button>
        <span className="text-sm text-slate-500">{selected.size} selected</span>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="min-w-max w-full text-sm border border-slate-300">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-2 py-1 border-b border-slate-300 w-8">
                <input type="checkbox" checked={allSelected} onChange={selectAllOrNone} />
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
            {rows.map((t, i) => (
              <tr
                key={t.id}
                className={`cursor-pointer ${selected.has(t.id) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                onClick={() => toggle(t.id)}
              >
                <td className="px-2 py-1 border-b border-slate-200 text-center">
                  <input type="checkbox" checked={selected.has(t.id)} readOnly />
                </td>
                <td className="px-3 py-1 border-b border-slate-200 font-mono text-xs text-slate-500">
                  {t.transaction_number}
                </td>
                <td className="px-3 py-1 border-b border-slate-200">{fmtDate(t.date)}</td>
                <td className="px-3 py-1 border-b border-slate-200">{t.from_to ?? ''}</td>
                <td className="px-3 py-1 border-b border-slate-200">{t.detail ?? ''}</td>
                <td className="px-3 py-1 border-b border-slate-200">{t.payment_method ?? ''}</td>
                <td className="px-3 py-1 border-b border-slate-200">{t.payment_ref ?? ''}</td>
                <td className="px-3 py-1 border-b border-slate-200 text-right font-mono">
                  {fmtAmt(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          {selected.size > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td colSpan={7} className="px-3 py-1 border-t border-slate-300 text-right">
                  Selected total:
                </td>
                <td className="px-3 py-1 border-t border-slate-300 text-right font-mono">
                  {fmtAmt(rows.filter((t) => selected.has(t.id)).reduce((s, t) => s + t.amount, 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
