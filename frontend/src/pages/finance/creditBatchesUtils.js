// beacon2026/frontend/src/pages/finance/creditBatchesUtils.js
//
// Pure helpers and shared Tailwind class strings used by CreditBatches and its
// extracted sub-views.

export const inputCls =
  'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
export const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';
export const btnDanger =
  'border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm';
export const btnSecondary =
  'border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm transition-colors';

export function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toISODate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}
