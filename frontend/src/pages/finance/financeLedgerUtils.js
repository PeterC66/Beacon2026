// beacon2026/frontend/src/pages/finance/financeLedgerUtils.js
//
// Pure helpers and constants shared by FinanceLedger and its extracted sections.

export const VIEWS = ['account', 'category', 'group', 'event'];

export const VIEW_LABELS = {
  account: 'Account',
  category: 'Category',
  group: 'Group/Team',
  event: 'Event',
};

const thisYear = new Date().getFullYear();
export { thisYear };
export const YEARS = Array.from({ length: 6 }, (_, i) => thisYear - i);

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
export const fmtAmount = (n) => (n != null ? `£${Number(n).toFixed(2)}` : '');

// Bulk-action eligibility: not cleared, not in a batch, not a transfer.
export const isEligible = (t) => !t.cleared_at && !t.batch_id && !t.transfer_id;
