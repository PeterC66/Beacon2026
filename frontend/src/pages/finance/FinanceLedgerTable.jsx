// beacon2026/frontend/src/pages/finance/FinanceLedgerTable.jsx
//
// The ledger transactions table of FinanceLedger — sortable header, balance-
// brought-forward rows, transaction rows with running balance, and the totals
// footer. Presentation only: sorting, selection, and data are owned by the
// parent.

import { Link } from 'react-router-dom';
import SortableHeader from '../../components/SortableHeader.jsx';
import { fmtDate, fmtAmount, isEligible } from './financeLedgerUtils.js';

const TH = 'px-2 py-2.5 font-normal';

export default function FinanceLedgerTable({
  view,
  showBulk,
  eligibleIds,
  selected,
  toggleAll,
  toggleSelect,
  sortKey,
  sortDir,
  onSort,
  withBalance,
  openingBal,
  groupBf,
  totals,
  tableRef,
  can,
  navigate,
}) {
  // Columns before "In": (Account when not account view) + #, Date, Batch,
  // From/To, Group/Team, Mem#, Detail, Category, PayRef, Method
  const dataLeadingCols = (view !== 'account' ? 1 : 0) + 10;

  return (
    <div className="overflow-x-auto rounded-lg shadow-sm" ref={tableRef}>
      <table className="w-full text-sm bg-white min-w-max">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
            {showBulk && (
              <th className="px-2 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={eligibleIds.size > 0 && selected.size === eligibleIds.size}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300"
                  title="Select all eligible"
                />
              </th>
            )}
            {view !== 'account' && (
              <SortableHeader
                col="account_name"
                label="Account"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className={TH}
              />
            )}
            <SortableHeader
              col="transaction_number"
              label="#"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="date"
              label="Date"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="batch_no"
              label="Batch"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="from_to"
              label="From/To"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="group_name"
              label="Group/Team"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="member_1_no"
              label="Mem#"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="detail"
              label="Detail"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="category_list"
              label="Category"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="payment_ref"
              label="Payment Ref"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <SortableHeader
              col="payment_method"
              label="Method"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className={TH}
            />
            <th className={`${TH} text-right`}>In</th>
            <th className={`${TH} text-right`}>Out</th>
            <th className={`${TH} text-right`}>Balance</th>
            <th className={`${TH} text-center`}>Cleared</th>
          </tr>
        </thead>
        <tbody>
          {view === 'account' && (
            <tr className="bg-slate-100 border-b border-slate-200 italic text-slate-600">
              {showBulk && <td className="px-2 py-2"></td>}
              <td className="px-2 py-2" colSpan={dataLeadingCols}>
                Balance brought forward
              </td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-right font-medium text-slate-700">
                {fmtAmount(openingBal)}
              </td>
              <td className="px-2 py-2"></td>
            </tr>
          )}
          {view === 'group' &&
            groupBf.length > 0 &&
            groupBf.map((bf) => (
              <tr
                key={`bf-${bf.group_id}`}
                className="bg-slate-100 border-b border-slate-200 italic text-slate-600"
              >
                <td className="px-2 py-2" colSpan={dataLeadingCols}>
                  Balance b/f
                  {bf.group_name ? ` — ${bf.group_short_name || bf.group_name}` : ''}
                </td>
                <td className="px-2 py-2 text-right text-green-700">
                  {bf.balance >= 0 ? fmtAmount(bf.balance) : ''}
                </td>
                <td className="px-2 py-2 text-right text-red-700">
                  {bf.balance < 0 ? fmtAmount(Math.abs(bf.balance)) : ''}
                </td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
              </tr>
            ))}
          {view === 'group' &&
            groupBf.length > 0 &&
            (() => {
              const totalBf = groupBf.reduce((s, bf) => s + bf.balance, 0);
              return (
                <tr className="bg-slate-200 border-b border-slate-300 font-bold text-slate-700">
                  <td className="px-2 py-2" colSpan={dataLeadingCols}>
                    Total Brought Forward
                  </td>
                  <td className="px-2 py-2 text-right text-green-700">
                    {totalBf >= 0 ? fmtAmount(totalBf) : ''}
                  </td>
                  <td className="px-2 py-2 text-right text-red-700">
                    {totalBf < 0 ? fmtAmount(Math.abs(totalBf)) : ''}
                  </td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                </tr>
              );
            })()}
          {withBalance.map((t, i) => (
            <tr
              key={t.id}
              className={`border-b border-slate-100 ${t.refund_of_id ? 'bg-red-50 text-red-700' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
            >
              {showBulk && (
                <td className="px-2 py-2">
                  {isEligible(t) && (
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  )}
                </td>
              )}
              {/* Account — hidden in account view (redundant) */}
              {view !== 'account' && (
                <td className="px-2 py-2 whitespace-nowrap">{t.account_name ?? ''}</td>
              )}
              {/* # — refund indicators ↩/↪ appear inline when a refund relationship exists */}
              <td className="px-2 py-2">
                <div className="flex items-center gap-1">
                  {can('finance_transactions', 'view') ? (
                    <button
                      onClick={() => navigate(`/finance/transactions/${t.id}`)}
                      className="text-blue-700 hover:underline font-mono"
                    >
                      {t.transaction_number}
                    </button>
                  ) : (
                    <span className="font-mono">{t.transaction_number}</span>
                  )}
                  {t.refund_of_id && (
                    <button
                      onClick={() => navigate(`/finance/transactions/${t.refund_of_id}`)}
                      className="text-red-500 hover:text-red-700 text-xs leading-none"
                      title={`Refund of #${t.refund_of_txn_number}`}
                    >
                      ↩
                    </button>
                  )}
                  {t.refunded_by_id && (
                    <button
                      onClick={() => navigate(`/finance/transactions/${t.refunded_by_id}`)}
                      className="text-blue-500 hover:text-blue-700 text-xs leading-none"
                      title={`Refunded by #${t.refunded_by_txn_number}`}
                    >
                      ↪
                    </button>
                  )}
                </div>
              </td>
              {/* Date */}
              <td className="px-2 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
              {/* Batch — number as link; hover for description */}
              <td className="px-2 py-2">
                {t.batch_no && can('finance_batches', 'view') ? (
                  <button
                    onClick={() => navigate(`/finance/batches?batchId=${t.batch_id}`)}
                    className="text-blue-700 hover:underline"
                    title={
                      t.batch_description ? `${t.batch_no}: ${t.batch_description}` : t.batch_no
                    }
                  >
                    {t.batch_no}
                  </button>
                ) : (
                  <span title={t.batch_description ?? ''}>{t.batch_no ?? ''}</span>
                )}
              </td>
              {/* From/To */}
              <td className="px-2 py-2 max-w-[140px] truncate" title={t.from_to}>
                {t.from_to}
              </td>
              {/* Group / Event */}
              <td className="px-2 py-2 max-w-[120px] truncate" title={t.group_name ?? ''}>
                {t.group_name && t.group_id ? (
                  <Link
                    to={`/${t.group_type === 'team' ? 'teams' : 'groups'}/${t.group_id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {t.group_short_name || t.group_name}
                  </Link>
                ) : (
                  t.group_short_name || t.group_name || ''
                )}
                {t.event_id && (
                  <div className="text-xs">
                    <Link
                      to={`/calendar/events/${t.event_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {t.event_label || t.event_topic || 'Event'}
                    </Link>
                  </div>
                )}
              </td>
              {/* Mem# — 2nd member shown below when present */}
              <td className="px-2 py-2">
                {t.member_1_no && t.member_id_1 && (
                  <Link
                    to={`/members/${t.member_id_1}`}
                    className="text-blue-700 hover:underline font-mono block"
                    title={t.member_1_name}
                  >
                    {t.member_1_no}
                  </Link>
                )}
                {t.member_2_no && t.member_id_2 && (
                  <Link
                    to={`/members/${t.member_id_2}`}
                    className="text-blue-700 hover:underline font-mono text-xs block"
                    title={t.member_2_name}
                  >
                    {t.member_2_no}
                  </Link>
                )}
              </td>
              {/* Detail */}
              <td className="px-2 py-2 max-w-[180px] truncate" title={t.detail}>
                {t.detail}
              </td>
              {/* Category */}
              <td className="px-2 py-2 max-w-[140px] truncate" title={t.category_list}>
                {t.category_list}
              </td>
              {/* Payment Ref */}
              <td className="px-2 py-2">{t.payment_ref ?? ''}</td>
              {/* Method */}
              <td className="px-2 py-2">{t.payment_method}</td>
              {/* In */}
              <td className="px-2 py-2 text-right text-green-700">
                {t.type === 'in'
                  ? fmtAmount(view === 'category' ? t.category_amount : t.amount)
                  : ''}
              </td>
              {/* Out */}
              <td className="px-2 py-2 text-right text-red-700">
                {t.type === 'out'
                  ? fmtAmount(view === 'category' ? t.category_amount : t.amount)
                  : ''}
              </td>
              {/* Balance */}
              <td
                className={`px-2 py-2 text-right font-medium ${
                  t.pending
                    ? 'text-slate-400 italic'
                    : t._balance >= 0
                      ? 'text-slate-700'
                      : 'text-red-600'
                }`}
              >
                {t.pending ? '' : fmtAmount(t._balance)}
              </td>
              {/* Cleared */}
              <td className="px-2 py-2 text-center text-xs text-slate-500">
                {t.pending ? (
                  <span className="text-amber-600 font-medium">Pending</span>
                ) : t.cleared_at ? (
                  fmtDate(t.cleared_at)
                ) : (
                  ''
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-300 font-medium text-sm">
            {showBulk && <td></td>}
            <td colSpan={dataLeadingCols} className="px-2 py-2 text-right text-slate-600">
              Totals:
            </td>
            <td className="px-2 py-2 text-right text-green-700">{fmtAmount(totals.in)}</td>
            <td className="px-2 py-2 text-right text-red-700">{fmtAmount(totals.out)}</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
