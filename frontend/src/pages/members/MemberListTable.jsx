// beacon2026/frontend/src/pages/members/MemberListTable.jsx
//
// Results section of MemberList — the "Select:" quick-select controls and the
// sortable member table. Presentation only: sorting, selection, and navigation
// are owned by the parent.

import SortableHeader from '../../components/SortableHeader.jsx';
import NoEmailIcon from '../../components/NoEmailIcon.jsx';
import { clickableKeyProps } from '../../lib/a11y.js';
import { formatShortAddress, isSubscriptionOverdue } from '../../lib/memberFormatters.js';
import { formatMemberName } from '../../hooks/usePreferences.js';

export default function MemberListTable({
  memberList,
  sorted,
  sortKey,
  sortDir,
  onSort,
  sortSurname,
  selected,
  toggleSelect,
  selectAll,
  clearAll,
  selectEmail,
  selectNoEmail,
  selectPortalPassword,
  selectNoPortalPassword,
  selectEmailNotConfirmed,
  rowRefs,
  tableRef,
  can,
  navigate,
}) {
  return (
    <>
      {/* Select controls */}
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <span className="text-sm text-slate-500">
          {memberList.length} member{memberList.length !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-medium text-slate-600">Select:</span>
        <button onClick={selectAll} className="text-sm text-blue-700 hover:underline">
          All
        </button>
        <button onClick={clearAll} className="text-sm text-blue-700 hover:underline">
          Clear All
        </button>
        <button onClick={selectEmail} className="text-sm text-blue-700 hover:underline">
          Email only
        </button>
        <button onClick={selectNoEmail} className="text-sm text-blue-700 hover:underline">
          Without email
        </button>
        <button onClick={selectPortalPassword} className="text-sm text-blue-700 hover:underline">
          Portal password set
        </button>
        <button onClick={selectNoPortalPassword} className="text-sm text-blue-700 hover:underline">
          Without portal password
        </button>
        <button onClick={selectEmailNotConfirmed} className="text-sm text-blue-700 hover:underline">
          Email not confirmed
        </button>
        {selected.size > 0 && (
          <span className="text-sm font-medium text-blue-700 ml-2">{selected.size} selected</span>
        )}
      </div>

      <div ref={tableRef} className="overflow-x-auto rounded-lg shadow-sm mb-3">
        <table className="w-full text-sm bg-white min-w-max">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
              <th className="px-2 py-2"></th>
              <SortableHeader
                col="membership_number"
                label="No"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-3 py-2 font-normal"
              />
              <th className="px-3 py-2 font-normal">
                <span
                  className="cursor-pointer select-none"
                  {...clickableKeyProps(() => onSort('forenames'))}
                >
                  Name
                  <span
                    className={`ml-1 text-xs ${sortKey === 'forenames' ? 'text-blue-600' : 'text-slate-300'}`}
                  >
                    {sortKey === 'forenames' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </span>
                <span className="text-slate-300 mx-1">|</span>
                <span
                  className="cursor-pointer select-none text-xs not-italic"
                  {...clickableKeyProps(() => onSort(sortSurname))}
                >
                  by surname
                  <span
                    className={`ml-1 text-xs ${Array.isArray(sortKey) && sortKey[0] === 'surname' ? 'text-blue-600' : 'text-slate-300'}`}
                  >
                    {Array.isArray(sortKey) && sortKey[0] === 'surname'
                      ? sortDir === 'asc'
                        ? '▲'
                        : '▼'
                      : '⇅'}
                  </span>
                </span>
              </th>
              <SortableHeader
                col="house_no"
                label="Address"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-3 py-2 font-normal"
              />
              <SortableHeader
                col="telephone"
                label="Telephone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-3 py-2 font-normal"
              />
              <SortableHeader
                col="mobile"
                label="Mobile"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-3 py-2 font-normal"
              />
              <SortableHeader
                col="class"
                label="Class"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-3 py-2 font-normal"
              />
              <SortableHeader
                col="status"
                label="Status"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="px-3 py-2 font-normal"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr
                key={m.id}
                ref={(el) => {
                  if (el) rowRefs.current[m.surname?.[0]?.toUpperCase()] = el;
                }}
                className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} ${selected.has(m.id) ? 'outline outline-2 outline-blue-400' : ''}`}
              >
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleSelect(m.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {!m.email && <NoEmailIcon className="ml-1" />}
                </td>
                <td
                  className={`px-3 py-2 tabular-nums ${isSubscriptionOverdue(m) ? 'text-red-600' : ''}`}
                >
                  {can('member_record', 'view') ? (
                    <a
                      href="#view"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/members/${m.id}`);
                      }}
                      className={`hover:underline ${isSubscriptionOverdue(m) ? 'text-red-600' : 'text-blue-700'}`}
                    >
                      {m.membership_number}
                    </a>
                  ) : (
                    m.membership_number
                  )}
                </td>
                <td
                  className={`px-3 py-2 font-medium ${isSubscriptionOverdue(m) ? 'text-red-600' : ''}`}
                >
                  {can('member_record', 'view') ? (
                    <a
                      href="#view"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/members/${m.id}`);
                      }}
                      className={`hover:underline ${isSubscriptionOverdue(m) ? 'text-red-600' : 'text-blue-700'}`}
                    >
                      {formatMemberName(m)}
                    </a>
                  ) : (
                    formatMemberName(m)
                  )}
                </td>
                <td className="px-3 py-2">{formatShortAddress(m)}</td>
                <td className="px-3 py-2">{m.telephone ?? ''}</td>
                <td className="px-3 py-2">{m.mobile ?? ''}</td>
                <td className="px-3 py-2">{m.class ?? ''}</td>
                <td className="px-3 py-2">{m.status ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
