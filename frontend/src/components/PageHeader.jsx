// beacon2/frontend/src/components/PageHeader.jsx
// Shared page header: u3a Beacon logo + tenant display name + app version.

import BeaconLogo from './BeaconLogo.jsx';

/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

export default function PageHeader({ tenant }) {
  const display = tenant
    ? tenant.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <div className="beacon-no-theme flex items-center gap-4 px-4 py-3 sm:px-8 bg-white/70 backdrop-blur-sm">
      <BeaconLogo />
      {display && (
        <span className="text-xl sm:text-4xl font-normal text-slate-900 truncate min-w-0">
          {display}
        </span>
      )}
      {APP_VERSION && (
        <span className="ml-auto text-xs text-slate-400 flex-shrink-0" title="Application version">
          v{APP_VERSION}
        </span>
      )}
    </div>
  );
}
