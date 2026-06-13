// beacon2/frontend/src/pages/system/RestoreConfirmModal.jsx
//
// Confirmation modal for the destructive restore action in SystemDashboard.
// Presentation only: state and handlers are owned by the parent.

export default function RestoreConfirmModal({
  restoreTenant,
  restoreFile,
  setConfirmOpen,
  handleConfirmRestore,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h3 className="text-lg font-bold text-slate-800 mb-3">Confirm restore</h3>
        <p className="text-sm text-slate-600 mb-1">
          Tenant: <strong>{restoreTenant}</strong>
        </p>
        <p className="text-sm text-slate-600 mb-2">File:</p>
        <p className="text-sm font-medium text-slate-800 bg-slate-100 rounded px-3 py-2 mb-4 break-all">
          {restoreFile?.name}
        </p>
        <p className="text-sm text-red-700 font-medium mb-5">
          All current data for this tenant will be permanently deleted and replaced. This cannot be
          undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setConfirmOpen(false)}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmRestore}
            className="bg-red-600 hover:bg-red-700 text-white rounded px-5 py-2 text-sm font-medium"
          >
            Yes, restore now
          </button>
        </div>
      </div>
    </div>
  );
}
