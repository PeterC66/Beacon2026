// beacon2/frontend/src/pages/finance/TransactionAssociations.jsx
//
// "Associate transaction with" section of TransactionEditor — member 1/2,
// group/team, and event pickers. Presentation only: all state and handlers
// are passed in from the parent.

import { INP_CLS as INP, LBL_CLS as LBL } from './transactionEditorUtils.js';

export default function TransactionAssociations({
  form,
  set,
  cleared,
  m1Filter,
  setM1Filter,
  filteredM1,
  m2Filter,
  setM2Filter,
  filteredM2,
  groupFilter,
  setGroupFilter,
  filteredGroups,
  filteredTeams,
  eventLabel,
  setEventLabel,
  eventSearch,
  setEventSearch,
  eventResults,
  setEventResults,
}) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Associate transaction with</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Member 1 */}
        <div>
          <label htmlFor="txn-member1" className={LBL}>
            Member 1
          </label>
          <input
            id="txn-member1-filter"
            type="text"
            name="m1Filter"
            value={m1Filter}
            onChange={(e) => setM1Filter(e.target.value)}
            disabled={cleared}
            className={`${INP} mb-1`}
            placeholder="Search name / number…"
          />
          <select
            id="txn-member1"
            name="member_id_1"
            value={form.member_id_1}
            onChange={(e) => set('member_id_1', e.target.value)}
            disabled={cleared}
            className={INP}
            size={4}
          >
            <option value="">— none —</option>
            {filteredM1.map((m) => (
              <option key={m.id} value={m.id}>
                {m.membership_number} {m.forenames} {m.surname}
              </option>
            ))}
          </select>
        </div>

        {/* Member 2 */}
        <div>
          <label htmlFor="txn-member2" className={LBL}>
            Member 2
          </label>
          {!form.member_id_1 && (
            <p className="text-xs text-slate-400 mb-1">Select Member 1 first</p>
          )}
          <input
            id="txn-member2-filter"
            type="text"
            name="m2Filter"
            value={m2Filter}
            onChange={(e) => setM2Filter(e.target.value)}
            disabled={cleared || !form.member_id_1}
            className={`${INP} mb-1`}
            placeholder="Search name / number…"
          />
          <select
            id="txn-member2"
            name="member_id_2"
            value={form.member_id_2}
            onChange={(e) => set('member_id_2', e.target.value)}
            disabled={cleared || !form.member_id_1}
            className={INP}
            size={4}
          >
            <option value="">— none —</option>
            {filteredM2.map((m) => (
              <option key={m.id} value={m.id}>
                {m.membership_number} {m.forenames} {m.surname}
              </option>
            ))}
          </select>
        </div>

        {/* Group / Team */}
        <div>
          <label htmlFor="txn-group-filter" className={LBL}>
            Group / Team
          </label>
          <input
            id="txn-group-filter"
            type="text"
            placeholder="Search name / abbreviation…"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            disabled={cleared}
            className={`${INP} mb-1`}
          />
          <select
            id="txn-group"
            name="group_id"
            value={form.group_id}
            onChange={(e) => set('group_id', e.target.value)}
            disabled={cleared}
            className={INP}
            size={5}
          >
            <option value="">— none —</option>
            {filteredGroups.length > 0 && (
              <optgroup label="Groups">
                {filteredGroups.map((g) => (
                  <option
                    key={g.id}
                    value={g.id}
                    style={g.status === 'inactive' ? { color: '#dc2626' } : {}}
                  >
                    {g.short_name || g.name}
                    {g.status === 'inactive' ? ' (inactive)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {filteredTeams.length > 0 && (
              <optgroup label="Teams">
                {filteredTeams.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    style={t.status === 'inactive' ? { color: '#dc2626' } : {}}
                  >
                    {t.short_name || t.name}
                    {t.status === 'inactive' ? ' (inactive)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Event */}
        <div>
          <label htmlFor="txn-event-search" className={LBL}>
            Event
          </label>
          {form.event_id ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">{eventLabel || form.event_id}</span>
              <button
                type="button"
                onClick={() => {
                  set('event_id', '');
                  setEventLabel('');
                  setEventSearch('');
                }}
                disabled={cleared}
                className="text-red-600 hover:underline text-xs"
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <input
                id="txn-event-search"
                type="text"
                placeholder="Search by topic, group name, or date…"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                disabled={cleared}
                className={`${INP} mb-1`}
              />
              {eventResults.length > 0 && (
                <ul className="border border-slate-200 rounded max-h-40 overflow-y-auto text-sm">
                  {eventResults.map((ev) => {
                    const lbl = ev.topic || ev.group_name || ev.event_type_name || 'Event';
                    const d = ev.event_date ? String(ev.event_date).slice(0, 10) : '';
                    return (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => {
                            set('event_id', ev.id);
                            setEventLabel(`${lbl} (${d})`);
                            setEventSearch('');
                            setEventResults([]);
                          }}
                          className="block w-full text-left px-2 py-1 hover:bg-blue-50"
                        >
                          {lbl}
                          {d ? ` — ${d}` : ''}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
