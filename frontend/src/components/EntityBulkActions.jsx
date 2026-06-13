// beacon2/frontend/src/components/EntityBulkActions.jsx
// "Do with selected" bulk-action bar (email / download / remove / add-to-other)
// plus the download field picker. Extracted from EntityMembers; presentation
// only — all state and handlers live in the parent and arrive as props.

export default function EntityBulkActions({
  entityType,
  entityId,
  selectedSize,
  bulkAction,
  setBulkAction,
  setBulkResult,
  setTargetEntityId,
  targetEntityId,
  allEntities,
  bulkWorking,
  bulkResult,
  handleBulkDo,
  addToAction,
  canManage,
  can,
  DL_FIELDS,
  dlFields,
  toggleDlField,
  handleDownload,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label
            htmlFor={`${entityType}-bulk-action`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Do with {selectedSize} selected member{selectedSize !== 1 ? 's' : ''}
          </label>
          <select
            id={`${entityType}-bulk-action`}
            name="bulkAction"
            value={bulkAction}
            onChange={(e) => {
              setBulkAction(e.target.value);
              setBulkResult(null);
              setTargetEntityId('');
            }}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— choose action —</option>
            {can('email', 'send') && <option value="send_email">Send email</option>}
            <option value="download_excel">Download Excel</option>
            <option value="download_pdf">Download PDF</option>
            {canManage && <option value="remove_members">Remove members</option>}
            {canManage && <option value={addToAction}>Add to another {entityType}</option>}
          </select>
        </div>

        {bulkAction === addToAction && (
          <div>
            <label
              htmlFor={`${entityType}-target-entity`}
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Target {entityType}
            </label>
            <select
              id={`${entityType}-target-entity`}
              name="targetEntityId"
              value={targetEntityId}
              onChange={(e) => setTargetEntityId(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— select {entityType} —</option>
              {allEntities
                .filter((e) => e.id !== entityId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {(bulkAction === 'send_email' ||
          bulkAction === 'remove_members' ||
          bulkAction === addToAction) && (
          <button
            onClick={handleBulkDo}
            disabled={bulkWorking || (bulkAction === addToAction && !targetEntityId)}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {bulkWorking ? 'Working…' : 'Do with selected'}
          </button>
        )}

        {bulkResult && (
          <p
            className={`text-sm font-medium ${bulkResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
          >
            {bulkResult.msg}
          </p>
        )}
      </div>

      {/* Field picker for Excel / PDF downloads */}
      {(bulkAction === 'download_excel' || bulkAction === 'download_pdf') && (
        <div className="border border-slate-200 rounded p-3 bg-slate-50">
          <p className="text-sm font-medium text-slate-700 mb-2">Fields to include:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mb-3">
            {DL_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dlFields.has(f.key)}
                  onChange={() => toggleDlField(f.key)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {f.label}
              </label>
            ))}
          </div>
          <button
            onClick={() => handleDownload(bulkAction === 'download_excel' ? 'excel' : 'pdf')}
            disabled={bulkWorking || dlFields.size === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {bulkWorking
              ? 'Downloading…'
              : `Download ${bulkAction === 'download_excel' ? 'Excel' : 'PDF'}`}
          </button>
        </div>
      )}
    </div>
  );
}
