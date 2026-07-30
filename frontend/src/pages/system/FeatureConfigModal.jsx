// beacon2026/frontend/src/pages/system/FeatureConfigModal.jsx
//
// Per-tenant feature-toggle modal of SystemDashboard. Presentation only: the
// config map, dirty/saving state and handlers are owned by the parent.

import { SECTIONS, getVal } from './systemDashboardConstants.js';

export default function FeatureConfigModal({
  fcTenant,
  fcConfig,
  fcLoading,
  fcSaving,
  fcError,
  fcSuccess,
  fcDirty,
  handleFcChange,
  handleFcSave,
  setFcTenant,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg mx-4 w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Feature Configuration</h3>
          <p className="text-sm text-slate-500">
            {fcTenant.name} ({fcTenant.slug})
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {fcLoading && <p className="text-center text-slate-500 py-4">Loading...</p>}

          {fcError && (
            <p className="rounded-md bg-red-50 border border-red-300 px-3 py-2 text-red-700 text-sm">
              {fcError}
            </p>
          )}

          {fcSuccess && (
            <p className="rounded-md bg-green-50 border border-green-300 px-3 py-2 text-green-700 text-sm font-medium">
              Feature configuration saved.
            </p>
          )}

          {!fcLoading &&
            SECTIONS.map((section) => {
              const masterOn = section.master
                ? getVal(fcConfig, section.master.key, section.master.defaultValue)
                : true;
              return (
                <div
                  key={section.title}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-2 font-semibold text-sm text-slate-800">
                    {section.title}
                  </div>
                  <div className="px-4 py-2 space-y-1">
                    {section.master && (
                      <label className="flex items-center gap-3 py-1 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={masterOn}
                          onChange={(e) => handleFcChange(section.master.key, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-700">{section.master.label}</span>
                      </label>
                    )}
                    {section.toggles.length > 0 && (
                      <div className="pl-6 space-y-1">
                        {section.toggles.map((t) => {
                          const parentOff = t.dependsOn && !getVal(fcConfig, t.dependsOn, true);
                          const checked = parentOff
                            ? false
                            : getVal(fcConfig, t.key, t.defaultValue);
                          return (
                            <label
                              key={t.key}
                              className={`flex items-center gap-3 py-0.5 text-sm ${parentOff ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={parentOff}
                                onChange={(e) => handleFcChange(t.key, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-slate-700">{t.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={() => setFcTenant(null)}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm"
          >
            {fcDirty ? 'Cancel' : 'Close'}
          </button>
          {fcDirty && (
            <button
              onClick={handleFcSave}
              disabled={fcSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium"
            >
              {fcSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
