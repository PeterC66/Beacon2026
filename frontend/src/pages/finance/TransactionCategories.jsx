// beacon2/frontend/src/pages/finance/TransactionCategories.jsx
//
// Category-allocation section of TransactionEditor. Presentation only: the
// running total/validation and category amounts are computed by the parent and
// passed in.

import RequiredMark from '../../components/RequiredMark.jsx';

export default function TransactionCategories({
  categories,
  catAmounts,
  setCatAmounts,
  markDirty,
  readOnly,
  amountOk,
  catOk,
  catTotal,
  amountNum,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">
        Category allocation <RequiredMark />
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Amounts must add up to the transaction amount.
        {amountOk && (
          <span className={catOk ? ' text-green-700 font-medium' : ' text-red-600 font-medium'}>
            {' '}
            Total: £{catTotal.toFixed(2)} / £{amountNum.toFixed(2)}
            {!catOk && ` — difference £${Math.abs(catTotal - amountNum).toFixed(2)}`}
          </span>
        )}
      </p>

      {categories.length === 0 ? (
        <p className="text-sm text-slate-400">
          No active categories. Add categories in Finance set-up.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-1.5 pr-4 font-medium">Category</th>
                <th className="py-1.5 w-36 font-medium">Amount (£)</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-4">{cat.name}</td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      name="categoryAmount"
                      min="0"
                      step="0.01"
                      value={catAmounts[cat.id] ?? ''}
                      onChange={(e) => {
                        markDirty();
                        setCatAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }));
                      }}
                      disabled={readOnly}
                      className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
