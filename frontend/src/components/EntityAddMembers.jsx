// beacon2/frontend/src/components/EntityAddMembers.jsx
// "Add a member" panel (by name dropdown or by membership number). Extracted
// from EntityMembers; presentation only — state and handlers arrive as props.

export default function EntityAddMembers({
  entityType,
  addError,
  addByName,
  setAddByName,
  availableToAdd,
  handleAddByName,
  addLoading,
  addByNumber,
  setAddByNumber,
  handleAddByNumber,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Add a member</h3>

      {addError && <p className="text-red-600 text-sm">{addError}</p>}

      {/* By name */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label
            htmlFor={`${entityType}-add-by-name`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Add member by name
          </label>
          <select
            id={`${entityType}-add-by-name`}
            name="addByName"
            value={addByName}
            onChange={(e) => setAddByName(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— select member —</option>
            {availableToAdd.map((m) => (
              <option key={m.id} value={m.id}>
                {m.surname}, {m.forenames}
                {m.known_as ? ` (${m.known_as})` : ''} — #{m.membership_number}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddByName}
          disabled={!addByName || addLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium"
        >
          Add
        </button>
      </div>

      {/* By membership number */}
      <div className="flex gap-2 items-end">
        <div>
          <label
            htmlFor={`${entityType}-add-by-number`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Add member by membership number
          </label>
          <input
            id={`${entityType}-add-by-number`}
            type="number"
            min="1"
            name="addByNumber"
            value={addByNumber}
            onChange={(e) => setAddByNumber(e.target.value)}
            placeholder="e.g. 42"
            className="border border-slate-300 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleAddByNumber}
          disabled={!addByNumber || addLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium"
        >
          Add
        </button>
      </div>
    </div>
  );
}
