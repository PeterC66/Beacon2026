// beacon2/frontend/src/components/EventMembers.jsx
// Event Members tab — manage members registered for an event.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SortableHeader from './SortableHeader.jsx';
import { calendar, members as membersApi } from '../lib/api.js';

export default function EventMembers({ eventId, groupId }) {
  const { can } = useAuth();
  const canChange   = can('event_attendance', 'change');
  const canDownload = can('event_attendance', 'download');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add-member state
  const [allMembers, setAllMembers] = useState([]);
  const [addByName, setAddByName] = useState('');
  const [addByNumber, setAddByNumber] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // Selection + sort
  const [selected, setSelected] = useState(new Set());
  const [sortCol, setSortCol] = useState('surname');
  const [sortDir, setSortDir] = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await calendar.listEventMembers(eventId);
      setRows(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    if (canChange) {
      membersApi.list().then(setAllMembers).catch(() => {});
    }
  }, [eventId, canChange, load]);

  // Sort
  function handleSort(col) {
    if (sortCol === col) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortCol(col); setSortDir('asc'); }
  }
  const sorted = [...rows].sort((a, b) => {
    const va = a[sortCol] ?? '';
    const vb = b[sortCol] ?? '';
    if (typeof va === 'boolean') return sortDir === 'asc' ? (va === vb ? 0 : va ? -1 : 1) : (va === vb ? 0 : va ? 1 : -1);
    const cmp = String(va).localeCompare(String(vb));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Selection
  function toggleSelect(memberId) {
    setSelected((prev) => { const n = new Set(prev); n.has(memberId) ? n.delete(memberId) : n.add(memberId); return n; });
  }

  // Add by name
  async function handleAddByName() {
    if (!addByName) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await calendar.addEventMembers(eventId, [addByName]);
      setAddByName('');
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  // Add by number
  async function handleAddByNumber() {
    const num = parseInt(addByNumber, 10);
    if (!num) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const match = allMembers.find((m) => m.membership_number === num);
      if (!match) throw new Error(`No member with number ${num}.`);
      await calendar.addEventMembers(eventId, [match.id]);
      setAddByNumber('');
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  // Copy from group
  async function handleCopyFromGroup() {
    if (!window.confirm('Copy all current group members into this event? (Existing event members won\'t be duplicated.)')) return;
    try {
      const result = await calendar.copyGroupToEvent(eventId);
      await load();
      setError(null);
      if (result.added === 0) setError('No new members to copy — all group members are already registered.');
    } catch (err) {
      setError(err.message);
    }
  }

  // Toggle organiser
  async function handleToggleOrganiser(memberId, current) {
    try {
      await calendar.updateEventMember(eventId, memberId, { isOrganiser: !current });
      setRows((prev) => prev.map((r) => r.member_id === memberId ? { ...r, is_organiser: !current } : r));
    } catch (err) {
      setError(err.message);
    }
  }

  // Remove selected
  async function handleRemoveSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Remove ${selected.size} member(s) from this event?`)) return;
    try {
      await calendar.removeEventMembers(eventId, [...selected]);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Download
  async function handleDownload() {
    try {
      const blob = await calendar.downloadEventMembers(eventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_members_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  // Which members can be added (not already registered)
  const memberIdsInEvent = new Set(rows.map((r) => r.member_id));
  const availableToAdd = allMembers.filter((m) => !memberIdsInEvent.has(m.id));

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap';
  const tdCls = 'px-3 py-2 text-sm text-slate-900 whitespace-nowrap';
  const cbCls = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';
  const btnCls = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium';

  if (loading) return <p className="text-slate-500 text-sm">Loading members...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-slate-500">{rows.length} member{rows.length !== 1 ? 's' : ''}</span>
        {rows.length > 0 && (
          <>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-600">Select:</span>
            <button onClick={() => setSelected(new Set(rows.map((r) => r.member_id)))} className="text-blue-700 hover:underline">All</button>
            <button onClick={() => setSelected(new Set())} className="text-blue-700 hover:underline">Clear</button>
            {selected.size > 0 && <span className="font-medium text-blue-700">{selected.size} selected</span>}
          </>
        )}
        {canChange && selected.size > 0 && (
          <button onClick={handleRemoveSelected} className="text-red-600 hover:underline ml-2">Remove selected</button>
        )}
        {canDownload && rows.length > 0 && (
          <button onClick={handleDownload} className="text-blue-700 hover:underline ml-auto">Download PDF</button>
        )}
      </div>

      {/* Members table */}
      {rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No members registered for this event.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm">
          <table className="min-w-full bg-white">
            <thead className="bg-slate-50">
              <tr>
                {canChange && <th className={thCls} style={{ width: 32 }} />}
                <SortableHeader label="No" column="membership_number" current={sortCol} direction={sortDir} onClick={handleSort} />
                <SortableHeader label="Surname" column="surname" current={sortCol} direction={sortDir} onClick={handleSort} />
                <SortableHeader label="Forenames" column="forenames" current={sortCol} direction={sortDir} onClick={handleSort} />
                <SortableHeader label="Organiser" column="is_organiser" current={sortCol} direction={sortDir} onClick={handleSort} />
                <th className={thCls}>Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sorted.map((r) => (
                <tr key={r.member_id} className={selected.has(r.member_id) ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                  {canChange && (
                    <td className="px-3 py-2">
                      <input type="checkbox" className={cbCls} checked={selected.has(r.member_id)}
                        onChange={() => toggleSelect(r.member_id)} />
                    </td>
                  )}
                  <td className={tdCls}>{r.membership_number}</td>
                  <td className={tdCls}>
                    <Link to={`/members/${r.member_id}`} className="text-blue-700 hover:underline">{r.surname}</Link>
                  </td>
                  <td className={tdCls}>{r.forenames}</td>
                  <td className={tdCls}>
                    {canChange ? (
                      <input type="checkbox" className={cbCls}
                        checked={r.is_organiser}
                        onChange={() => handleToggleOrganiser(r.member_id, r.is_organiser)} />
                    ) : (
                      r.is_organiser ? 'Yes' : ''
                    )}
                  </td>
                  <td className={`${tdCls} max-w-[200px] truncate`}>{r.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Copy from group */}
      {canChange && groupId && (
        <button onClick={handleCopyFromGroup} className={`${btnCls} bg-green-600 hover:bg-green-700`}>
          Copy members from group
        </button>
      )}

      {/* Add members */}
      {canChange && (
        <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Add a member</h3>
          {addError && <p className="text-red-600 text-sm">{addError}</p>}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="event-add-by-name" className="block text-sm font-medium text-slate-700 mb-1">Add member by name</label>
              <select
                id="event-add-by-name"
                value={addByName}
                onChange={(e) => setAddByName(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— select member —</option>
                {availableToAdd.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.surname}, {m.forenames}{m.known_as ? ` (${m.known_as})` : ''} — #{m.membership_number}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleAddByName} disabled={!addByName || addLoading} className={btnCls}>Add</button>
          </div>

          <div className="flex gap-2 items-end">
            <div>
              <label htmlFor="event-add-by-number" className="block text-sm font-medium text-slate-700 mb-1">Add member by membership number</label>
              <input
                id="event-add-by-number"
                type="number" min="1"
                value={addByNumber}
                onChange={(e) => setAddByNumber(e.target.value)}
                placeholder="e.g. 42"
                className="border border-slate-300 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={handleAddByNumber} disabled={!addByNumber || addLoading} className={btnCls}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
