// beacon2/frontend/src/pages/reports/ReportResults.jsx
// Shared results table + metadata line for the reports feature.

export default function ReportResults({ result }) {
  if (!result) return null;
  const { columns, rows, rowCount, truncated, durationMs } = result;

  return (
    <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-2 text-xs text-slate-600 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-3">
        <span>{rowCount} row{rowCount === 1 ? '' : 's'}</span>
        <span>{durationMs} ms</span>
        {truncated && (
          <span className="text-amber-700">Results truncated — export for the full set.</span>
        )}
      </div>
      <div className="overflow-x-auto">
        {columns.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No rows returned.</p>
        ) : (
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                {columns.map((c) => (
                  <th key={c} className="px-4 py-2 font-normal whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                  {columns.map((c) => (
                    <td key={c} className="px-4 py-2 align-top whitespace-pre-wrap">
                      {formatCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object')  return JSON.stringify(v);
  return String(v);
}
