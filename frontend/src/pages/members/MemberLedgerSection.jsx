// beacon2026/frontend/src/pages/members/MemberLedgerSection.jsx
//
// Read-only "Groups, Teams and Ledger" block shown on an existing member's
// record. Extracted from MemberEditor; presentation only, no local state.

import { SECTION_CLS } from './memberEditorStyles.js';

export default function MemberLedgerSection({ ledgerLoading, memberGroups, memberTxns, can }) {
  return (
    <div className={SECTION_CLS}>
      <h2 className="text-base font-semibold text-slate-700 mb-3">Groups, Teams and Ledger</h2>
      {ledgerLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Groups */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Groups</h3>
            {memberGroups.filter((g) => g.type === 'group').length === 0 ? (
              <p className="text-sm text-slate-400 italic">Not a member of any groups.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic">
                      <th className="px-3 py-2 font-normal">Group name</th>
                      <th className="px-3 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberGroups
                      .filter((g) => g.type === 'group')
                      .map((g, i) => (
                        <tr
                          key={g.id}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                        >
                          <td className="px-3 py-1.5">
                            {can('group_records_all', 'view') ? (
                              <a
                                href={`/groups/${g.id}`}
                                className="text-blue-700 hover:underline"
                                title={g.short_name ? g.name : 'Press to access the group record'}
                              >
                                {g.short_name || g.name}
                              </a>
                            ) : (
                              <span
                                className={g.status === 'inactive' ? 'text-red-600' : ''}
                                title={g.short_name ? g.name : undefined}
                              >
                                {g.short_name || g.name}
                              </span>
                            )}
                            {g.is_leader && (
                              <span className="ml-1.5 text-amber-500" title="Leader">
                                ★
                              </span>
                            )}
                            {g.waiting_since && (
                              <span className="ml-1.5 text-slate-400" title="Waiting list">
                                ⏳
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {g.status === 'inactive' ? (
                              <span className="text-red-600 font-medium">Inactive</span>
                            ) : (
                              <span className="text-slate-500">Active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Teams */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Teams</h3>
            {memberGroups.filter((g) => g.type === 'team').length === 0 ? (
              <p className="text-sm text-slate-400 italic">Not a member of any teams.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic">
                      <th className="px-3 py-2 font-normal">Team name</th>
                      <th className="px-3 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberGroups
                      .filter((g) => g.type === 'team')
                      .map((t, i) => (
                        <tr
                          key={t.id}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                        >
                          <td className="px-3 py-1.5">
                            {can('group_records_all', 'view') ? (
                              <a
                                href={`/teams/${t.id}`}
                                className="text-blue-700 hover:underline"
                                title={t.short_name ? t.name : 'Press to access the team record'}
                              >
                                {t.short_name || t.name}
                              </a>
                            ) : (
                              <span
                                className={t.status === 'inactive' ? 'text-red-600' : ''}
                                title={t.short_name ? t.name : undefined}
                              >
                                {t.short_name || t.name}
                              </span>
                            )}
                            {t.is_leader && (
                              <span className="ml-1.5 text-amber-500" title="Leader">
                                ★
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {t.status === 'inactive' ? (
                              <span className="text-red-600 font-medium">Inactive</span>
                            ) : (
                              <span className="text-slate-500">Active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Transactions */}
          {can('finance_ledger', 'view') && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Transactions</h3>
              {memberTxns.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No transactions linked to this member.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic">
                        <th className="px-3 py-2 font-normal">#</th>
                        <th className="px-3 py-2 font-normal">Date</th>
                        <th className="px-3 py-2 font-normal">Detail</th>
                        <th className="px-3 py-2 font-normal">Account</th>
                        <th
                          className="px-3 py-2 font-normal text-right"
                          title="+/- means the member paid/received"
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberTxns.map((t, i) => (
                        <tr
                          key={t.id}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                        >
                          <td className="px-3 py-1.5">
                            {can('finance_transactions', 'view') ? (
                              <a
                                href={`/finance/transactions/${t.id}`}
                                className="text-blue-700 hover:underline font-mono"
                                title="Press to access the transaction record"
                              >
                                {t.transaction_number}
                              </a>
                            ) : (
                              <span className="font-mono">{t.transaction_number}</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {t.date ? new Date(t.date).toLocaleDateString('en-GB') : ''}
                          </td>
                          <td className="px-3 py-1.5 max-w-[200px] truncate" title={t.detail}>
                            {t.detail}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{t.account_name}</td>
                          <td
                            className={`px-3 py-1.5 text-right font-medium ${t.type === 'in' ? 'text-green-700' : 'text-red-700'}`}
                          >
                            {t.type === 'in' ? '+' : '−'}£{Number(t.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
