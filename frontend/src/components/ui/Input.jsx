// beacon2/frontend/src/components/ui/Input.jsx
// Shared input class string — use instead of redefining inputCls locally.
// Export as a constant for use with plain <input className={inputCls} />.

export const inputCls =
  'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export const inputClsCompact =
  'border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export const selectCls = inputCls;

export const inputErrCls =
  'border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';

export const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
