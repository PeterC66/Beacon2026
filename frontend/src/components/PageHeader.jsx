// beacon2/frontend/src/components/PageHeader.jsx
// Shared page header: u3a Beacon logo + tenant display name.

import BeaconLogo from './BeaconLogo.jsx';

export default function PageHeader({ tenant }) {
  const display = tenant
    ? tenant.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <div className="flex items-center gap-4 px-4 py-3 sm:px-8 bg-white/70 backdrop-blur-sm">
      <BeaconLogo />
      {display && (
        <span className="text-xl sm:text-4xl font-normal text-slate-900 truncate min-w-0">
          {display}
        </span>
      )}
    </div>
  );
}
