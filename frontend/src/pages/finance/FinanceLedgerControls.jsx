// beacon2/frontend/src/pages/finance/FinanceLedgerControls.jsx
//
// Controls bar of FinanceLedger — the view selector, the account/category/group/
// event picker, and the year selector. Presentation only: all state and handlers
// are owned by the parent.

import { VIEWS, VIEW_LABELS, YEARS } from './financeLedgerUtils.js';

export default function FinanceLedgerControls({
  view,
  setView,
  setSearchParams,
  year,
  setYear,
  accounts,
  categories,
  filteredGroups,
  selId,
  setSelId,
  groupFilter,
  setGroupFilter,
  eventSearch,
  setEventSearch,
  eventResults,
  setEventResults,
  eventLabel,
  setEventLabel,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-4 items-end">
      {/* View selector */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">View by</label>
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setSearchParams({ view: v });
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Selector */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-slate-600 mb-1">{VIEW_LABELS[view]}</label>
        {view === 'group' && (
          <input
            type="text"
            name="groupFilter"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            placeholder="Filter groups & teams…"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
          />
        )}
        {view === 'event' ? (
          selId ? (
            <div className="flex items-center gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50">
              <span className="flex-1 text-slate-700">{eventLabel || 'Selected event'}</span>
              <button
                type="button"
                onClick={() => {
                  setSelId('');
                  setEventLabel('');
                  setEventSearch('');
                  setEventResults([]);
                }}
                className="text-red-600 hover:underline text-xs"
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                name="eventSearch"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search by topic, group name, or date…"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {eventResults.length > 0 && (
                <ul className="border border-slate-200 rounded max-h-40 overflow-y-auto text-sm bg-white mt-1">
                  {eventResults.map((ev) => {
                    const lbl = ev.topic || ev.group_name || ev.event_type_name || 'Event';
                    const d = ev.event_date ? String(ev.event_date).slice(0, 10) : '';
                    return (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelId(ev.id);
                            setEventLabel(`${lbl}${d ? ` — ${d}` : ''}`);
                            setEventSearch('');
                            setEventResults([]);
                          }}
                          className="block w-full text-left px-2 py-1 hover:bg-blue-50"
                        >
                          {lbl}
                          {d ? ` — ${d}` : ''}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )
        ) : (
          <select
            name="selId"
            value={selId}
            onChange={(e) => setSelId(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— select —</option>
            {view === 'account' &&
              accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            {view === 'category' &&
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            {view === 'group' && (
              <>
                <option value="all">All groups &amp; teams</option>
                {filteredGroups.map((g) => (
                  <option
                    key={g.id}
                    value={g.id}
                    style={g.status === 'inactive' ? { color: '#dc2626' } : {}}
                  >
                    {g.short_name || g.name}
                    {g.status === 'inactive' ? ' (inactive)' : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        )}
      </div>

      {/* Year — not used in event view (all transactions for the event are shown) */}
      {view !== 'event' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
          <select
            name="year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
