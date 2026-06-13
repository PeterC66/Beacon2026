// beacon2/frontend/src/pages/members/MemberListFilters.jsx
//
// Filter panel for MemberList — status checkboxes, class/poll/payment-method
// selectors, and the Quick Find / custom-field search forms. Presentation only:
// all filter state and handlers are owned by the parent.

import { ALL_PAYMENT_METHODS as PAYMENT_METHODS } from '../../lib/constants.js';

export default function MemberListFilters({
  statuses,
  selectedStatuses,
  setSelectedStatuses,
  toggleStatus,
  classes,
  selectedClass,
  setSelectedClass,
  polls,
  selectedPoll,
  setSelectedPoll,
  negatePoll,
  setNegatePoll,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  searchInput,
  setSearchInput,
  activeSearch,
  handleSearch,
  handleCancelSearch,
  hasCfLabels,
  cfLabelNames,
  cfInput,
  setCfInput,
  activeCf,
  handleCfSearch,
  handleCancelCf,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-3 space-y-3">
      {/* Status checkboxes */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-slate-700 mr-1">Status:</span>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selectedStatuses.length === 0}
            onChange={() => setSelectedStatuses([])}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          All
        </label>
        {statuses.map((s) => (
          <label key={s.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selectedStatuses.includes(s.id)}
              onChange={() => toggleStatus(s.id)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {s.name}
          </label>
        ))}
      </div>

      {/* Class + Poll + search row */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
          <select
            name="selectedClass"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {polls.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
            <div className="flex gap-2 items-center">
              <select
                name="selectedPoll"
                value={selectedPoll}
                onChange={(e) => setSelectedPoll(e.target.value)}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All members</option>
                {polls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedPoll && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={negatePoll}
                    onChange={(e) => setNegatePoll(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Negate poll
                </label>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment method</label>
          <select
            name="selectedPaymentMethod"
            value={selectedPaymentMethod}
            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">- any -</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quick Find</label>
            <input
              type="text"
              name="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, address, postcode, no…"
              className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium"
          >
            Search
          </button>
          {activeSearch && (
            <button
              type="button"
              onClick={handleCancelSearch}
              className="border border-slate-300 rounded px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel Search
            </button>
          )}
        </form>

        {hasCfLabels && (
          <form onSubmit={handleCfSearch} className="flex gap-2 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custom Fields</label>
              <input
                type="text"
                name="customFieldSearch"
                value={cfInput}
                onChange={(e) => setCfInput(e.target.value)}
                placeholder={cfLabelNames}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium"
            >
              Search
            </button>
            {activeCf && (
              <button
                type="button"
                onClick={handleCancelCf}
                className="border border-slate-300 rounded px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
