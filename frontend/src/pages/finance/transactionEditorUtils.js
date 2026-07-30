// beacon2026/frontend/src/pages/finance/transactionEditorUtils.js
//
// Pure helpers, constants, and shared Tailwind class strings used by
// TransactionEditor and its extracted sections.

import { FINANCE_PAYMENT_METHODS } from '../../lib/constants.js';

export const PAYMENT_METHODS = ['', ...FINANCE_PAYMENT_METHODS];

export const today = () => new Date().toISOString().slice(0, 10);

export const BLANK = {
  account_id: '',
  date: today(),
  type: 'in',
  from_to: '',
  amount: '',
  payment_method: '',
  payment_ref: '',
  detail: '',
  remarks: '',
  member_id_1: '',
  member_id_2: '',
  group_id: '',
  event_id: '',
  pending: false,
  gift_aid_amount: '',
  gift_aid_amount_2: '',
};

export const INP_CLS =
  'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
export const LBL_CLS = 'block text-sm font-medium text-slate-700 mb-1';
