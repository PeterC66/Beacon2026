// beacon2/frontend/src/pages/system/RestoreBackupSection.jsx
//
// "Restore from Backup" section of SystemDashboard. Presentation only: restore
// state and handlers are owned by the parent.

export default function RestoreBackupSection({
  tenants,
  restoreFileRef,
  restoreTenant,
  setRestoreTenant,
  restoreFile,
  restoring,
  restoreResult,
  setRestoreResult,
  restoreError,
  setRestoreError,
  handleRestoreFileChange,
  handleRestoreClick,
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-700 mb-1">Restore from Backup</h2>
      <p className="text-sm text-slate-500 mb-4">
        Upload a Beacon2 backup or a legacy Beacon export file to restore a tenant&apos;s data. The
        format is detected automatically. User accounts and roles are included in the restore.
      </p>

      <div className="rounded-md bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800 text-sm mb-5">
        <strong>Warning:</strong> Restoring will{' '}
        <strong>permanently delete all current data</strong> for the selected tenant and replace it
        with the contents of the uploaded file. This cannot be undone.
      </div>

      {restoreError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium">
          {restoreError}
        </div>
      )}

      {restoreResult && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-800 text-sm font-medium whitespace-pre-line">
          ✓ {restoreResult.message}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select tenant</label>
          <select
            name="restoreTenant"
            value={restoreTenant}
            onChange={(e) => {
              setRestoreTenant(e.target.value);
              setRestoreResult(null);
              setRestoreError('');
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— choose a tenant —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Select backup file (.xlsx)
          </label>
          <input
            ref={restoreFileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleRestoreFileChange}
            className="block text-sm text-slate-600
              file:mr-3 file:py-2 file:px-4 file:rounded file:border-0
              file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {restoreFile && (
            <p className="text-xs text-slate-500 mt-1">
              {restoreFile.name} ({(restoreFile.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        <button
          onClick={handleRestoreClick}
          disabled={!restoreTenant || !restoreFile || restoring}
          className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 disabled:cursor-not-allowed"
        >
          {restoring ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Restoring…
            </>
          ) : (
            'Restore from this file'
          )}
        </button>
      </div>
    </section>
  );
}
