// beacon2026/frontend/src/pages/members/MemberListBulkActions.jsx
//
// "Do with selected members" panel of MemberList — action picker, the
// poll/group/team target selectors, and the download field picker. Presentation
// only: all state and handlers are owned by the parent.

import { DOWNLOAD_FIELDS } from './memberListConstants.js';

export default function MemberListBulkActions({
  selected,
  bulkAction,
  setBulkAction,
  setBulkResult,
  setDlError,
  can,
  hasFeature,
  hasBulkPolls,
  hasBulkGroups,
  hasBulkTeams,
  polls,
  addToPollId,
  setAddToPollId,
  allGroups,
  addToGroupId,
  setAddToGroupId,
  allTeams,
  addToTeamId,
  setAddToTeamId,
  handleBulkDo,
  bulkWorking,
  bulkResult,
  handleDownload,
  downloading,
  dlError,
  dlFields,
  toggleDlField,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}
          </label>
          <select
            name="bulkAction"
            value={bulkAction}
            onChange={(e) => {
              setBulkAction(e.target.value);
              setBulkResult(null);
              setDlError(null);
            }}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— choose action —</option>
            {can('email', 'send') && hasFeature('email') && (
              <option value="send_email">Send email</option>
            )}
            {can('letters', 'view') && hasFeature('letters') && (
              <option value="send_letter">Send letter</option>
            )}
            {hasBulkPolls && <option value="add_to_poll">Add to poll</option>}
            {hasBulkGroups && <option value="add_to_group">Add to group</option>}
            {hasBulkTeams && <option value="add_to_team">Add to team</option>}
            <option value="download_excel">Download Excel</option>
            <option value="download_pdf">Download PDF</option>
            <option value="download_emails">Download email addresses</option>
          </select>
        </div>

        {bulkAction === 'add_to_poll' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
            <select
              name="addToPollId"
              value={addToPollId}
              onChange={(e) => setAddToPollId(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— select poll —</option>
              {polls.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {bulkAction === 'add_to_group' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
            <select
              name="addToGroupId"
              value={addToGroupId}
              onChange={(e) => setAddToGroupId(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— select group —</option>
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {bulkAction === 'add_to_team' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
            <select
              name="addToTeamId"
              value={addToTeamId}
              onChange={(e) => setAddToTeamId(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— select team —</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(bulkAction === 'send_email' ||
          bulkAction === 'send_letter' ||
          bulkAction === 'add_to_poll' ||
          bulkAction === 'add_to_group' ||
          bulkAction === 'add_to_team') && (
          <button
            onClick={handleBulkDo}
            disabled={
              bulkWorking ||
              (bulkAction === 'add_to_poll' && !addToPollId) ||
              (bulkAction === 'add_to_group' && !addToGroupId) ||
              (bulkAction === 'add_to_team' && !addToTeamId)
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {bulkWorking ? 'Working…' : 'Do with selected'}
          </button>
        )}

        {bulkAction === 'download_emails' && (
          <button
            onClick={() => handleDownload('email-csv')}
            disabled={downloading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        )}

        {bulkResult && (
          <p
            className={`text-sm font-medium ${bulkResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
          >
            {bulkResult.msg}
          </p>
        )}
        {dlError && <p className="text-sm text-red-600 font-medium">{dlError}</p>}
      </div>

      {/* Field picker for Excel / PDF downloads */}
      {(bulkAction === 'download_excel' || bulkAction === 'download_pdf') && (
        <div className="border border-slate-200 rounded p-3 bg-slate-50">
          <p className="text-sm font-medium text-slate-700 mb-2">Fields to include:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mb-3">
            {DOWNLOAD_FIELDS.map((f) => (
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
            disabled={downloading || dlFields.size === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {downloading
              ? 'Downloading…'
              : `Download ${bulkAction === 'download_excel' ? 'Excel' : 'PDF'}`}
          </button>
        </div>
      )}
    </div>
  );
}
