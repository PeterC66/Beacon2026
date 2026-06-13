// beacon2/frontend/src/pages/finance/TransactionGiftAidSection.jsx
//
// Gift Aid section of TransactionEditor — per-member eligible amounts and the
// read-only "claimed" dates. Presentation only: state and handlers are passed
// in from the parent. The parent decides whether to render this at all (only
// for incoming transactions with at least one member).

import { LBL_CLS as LBL } from './transactionEditorUtils.js';

export default function TransactionGiftAidSection({
  form,
  set,
  readOnly,
  giftAidClaimedAt,
  giftAidClaimedAt2,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Gift Aid</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {form.member_id_1 && (
          <div>
            <label htmlFor="txn-ga-amount1" className={LBL}>
              Gift aid eligible (Member 1)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm">£</span>
              <input
                id="txn-ga-amount1"
                type="number"
                name="gift_aid_amount"
                min="0"
                step="0.01"
                value={form.gift_aid_amount}
                onChange={(e) => set('gift_aid_amount', e.target.value)}
                disabled={readOnly || !!giftAidClaimedAt}
                className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                title="Enter the amount (if any) that is eligible for Gift Aid"
              />
            </div>
            {giftAidClaimedAt && (
              <div className="mt-2">
                <label htmlFor="txn-ga-claimed1" className={LBL}>
                  Gift aid claimed
                </label>
                <input
                  id="txn-ga-claimed1"
                  type="text"
                  value={new Date(giftAidClaimedAt).toLocaleDateString('en-GB')}
                  readOnly
                  className="border border-slate-200 bg-slate-50 rounded px-2 py-1 text-sm w-32 text-slate-600"
                  title="The date on which Gift Aid was claimed. This field is normally entered automatically."
                />
              </div>
            )}
          </div>
        )}
        {form.member_id_2 && (
          <div>
            <label htmlFor="txn-ga-amount2" className={LBL}>
              Gift aid eligible (Member 2)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-sm">£</span>
              <input
                id="txn-ga-amount2"
                type="number"
                name="gift_aid_amount_2"
                min="0"
                step="0.01"
                value={form.gift_aid_amount_2}
                onChange={(e) => set('gift_aid_amount_2', e.target.value)}
                disabled={readOnly || !!giftAidClaimedAt2}
                className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                title="Enter the amount (if any) that is eligible for Gift Aid"
              />
            </div>
            {giftAidClaimedAt2 && (
              <div className="mt-2">
                <label htmlFor="txn-ga-claimed2" className={LBL}>
                  Gift aid claimed
                </label>
                <input
                  id="txn-ga-claimed2"
                  type="text"
                  value={new Date(giftAidClaimedAt2).toLocaleDateString('en-GB')}
                  readOnly
                  className="border border-slate-200 bg-slate-50 rounded px-2 py-1 text-sm w-32 text-slate-600"
                  title="The date on which Gift Aid was claimed. This field is normally entered automatically."
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
