// beacon2/frontend/src/components/PortalVersion.jsx
// Discrete version badge for portal screens — top-right corner.

/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

export default function PortalVersion() {
  if (!APP_VERSION) return null;
  return (
    <span className="absolute top-2 right-3 text-xs text-slate-400 select-none pointer-events-none">
      v{APP_VERSION}
    </span>
  );
}
