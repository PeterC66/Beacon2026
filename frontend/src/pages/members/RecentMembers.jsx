// beacon2/frontend/src/pages/members/RecentMembers.jsx
// Doc 4.4 — Recent Members

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { members as membersApi, groups as groupsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import DateInput from '../../components/DateInput.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { formatShortAddress, formatPhone } from '../../lib/memberFormatters.js';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function iso30DaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export default function RecentMembers() {
  const { can, tenant } = useAuth();
  const [list,       setList]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [fromDate,   setFromDate]   = useState(iso30DaysAgo());
  const [toDate,     setToDate]     = useState(isoToday());
  const [filterErr,  setFilterErr]  = useState(null);
  const [selected,   setSelected]   = useState(new Set());
  const [action,     setAction]     = useState('download_names');
  const [doingAction, setDoingAction] = useState(false);
  const [actionMsg,  setActionMsg]  = useState(null);

  // For "Add to group"
  const [groups,      setGroups]    = useState([]);
  const [chosenGroup, setChosenGroup] = useState('');
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(list, 'joined_on', 'desc');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setFilterErr(null);
    setSelected(new Set());
    setActionMsg(null);
    try {
      const data = await membersApi.recent({ from: fromDate, to: toDate });
      setList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleApply(e) {
    e.preventDefault();
    if (!fromDate || !toDate) { setFilterErr('Both dates are required.'); return; }
    if (fromDate > toDate)    { setFilterErr('"From" must be before "To".'); return; }
    load();
  }

  function toggleAll(checked) {
    if (checked) setSelected(new Set(sorted.map((m) => m.id)));
    else         setSelected(new Set());
  }

  function toggleOne(id, checked) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  }

  async function handleDoWithSelected(e) {
    e.preventDefault();
    if (selected.size === 0) { setActionMsg({ type: 'error', text: 'No members selected.' }); return; }
    setDoingAction(true);
    setActionMsg(null);

    if (action === 'download_names') {
      const names = list
        .filter((m) => selected.has(m.id))
        .map((m) => `${m.forenames} ${m.surname}`)
        .join(', ');
      const blob = new Blob([names], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'recent_members.txt';
      a.click();
      URL.revokeObjectURL(url);
      setDoingAction(false);
      return;
    }

    if (action === 'add_to_group') {
      // Load groups if not already loaded
      if (groups.length === 0) {
        try {
          const grps = await groupsApi.list();
          setGroups(grps.filter((g) => g.status === 'Active'));
          setChosenGroup(grps.filter((g) => g.status === 'Active')[0]?.id || '');
        } catch (err) {
          setActionMsg({ type: 'error', text: 'Could not load groups: ' + err.message });
          setDoingAction(false);
          return;
        }
      }
      setShowGroupPicker(true);
      setDoingAction(false);
      return;
    }

    setDoingAction(false);
  }

  async function handleAddToGroup() {
    if (!chosenGroup) return;
    setDoingAction(true);
    setActionMsg(null);
    const ids = [...selected];
    let added = 0;
    let errors = 0;
    for (const memberId of ids) {
      try {
        await groupsApi.addMember(chosenGroup, { memberId });
        added++;
      } catch {
        errors++;
      }
    }
    setShowGroupPicker(false);
    setDoingAction(false);
    const msg = `Added ${added} member${added !== 1 ? 's' : ''} to group.` +
      (errors > 0 ? ` (${errors} already in group or error.)` : '');
    setActionMsg({ type: 'success', text: msg });
  }

  const allChecked = sorted.length > 0 && sorted.every((m) => selected.has(m.id));

  const INPUT  = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const SELECT = INPUT;
  const TH     = 'px-4 py-2.5 font-normal text-left';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Recent Members' }]} />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Recent Members</h1>

        {/* Date range filter */}
        <form onSubmit={handleApply} className="bg-white/90 rounded-lg shadow-sm p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
            <DateInput value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <DateInput value={toDate} onChange={setToDate} />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
            Apply
          </button>
          {filterErr && <p className="text-sm text-red-600">{filterErr}</p>}
        </form>

        {/* Status messages */}
        {actionMsg && (
          <p className={`text-sm font-medium px-4 py-2 rounded border ${
            actionMsg.type === 'success'
              ? 'text-green-700 bg-green-50 border-green-200'
              : 'text-red-700 bg-red-50 border-red-300'
          }`}>{actionMsg.text}</p>
        )}

        {/* Add-to-group picker */}
        {showGroupPicker && (
          <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Select a group to add the {selected.size} selected member{selected.size !== 1 ? 's' : ''} to:</p>
            <select
              name="chosenGroup"
              value={chosenGroup}
              onChange={(e) => setChosenGroup(e.target.value)}
              className={SELECT + ' w-64'}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddToGroup}
                disabled={doingAction || !chosenGroup}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
              >
                Add to group
              </button>
              <button
                onClick={() => setShowGroupPicker(false)}
                className="border border-slate-300 text-slate-600 hover:bg-slate-50 rounded px-5 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {sorted.length} member{sorted.length !== 1 ? 's' : ''} joined between {fmtDate(fromDate)} and {fmtDate(toDate)}.
            </p>

            {/* Bulk actions */}
            {sorted.length > 0 && (
              <form onSubmit={handleDoWithSelected} className="flex flex-wrap items-center gap-3">
                <select
                  name="action"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className={SELECT}
                >
                  <option value="download_names">Download names as a txt file</option>
                  {can('groups_list', 'view') && (
                    <option value="add_to_group">Add to group</option>
                  )}
                </select>
                <button
                  type="submit"
                  disabled={doingAction || selected.size === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
                >
                  Do with selected
                </button>
                {selected.size > 0 && (
                  <span className="text-sm text-slate-600">{selected.size} selected</span>
                )}
              </form>
            )}

            {/* Members table */}
            <div className="overflow-x-auto">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <SortableHeader col="membership_number" label="#" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <SortableHeader col="surname"    label="Name"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <SortableHeader col="class_name" label="Class"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <SortableHeader col="status_name" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <SortableHeader col="joined_on"  label="Joined"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <th className={TH}>Address</th>
                    <th className={TH}>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={(e) => toggleOne(m.id, e.target.checked)}
                          aria-label={`Select ${m.forenames} ${m.surname}`}
                        />
                      </td>
                      <td className="px-4 py-2">{m.membership_number}</td>
                      <td className="px-4 py-2">
                        <Link to={`/members/${m.id}`} className="text-blue-600 hover:underline">
                          {m.forenames} {m.surname}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{m.class_name ?? '—'}</td>
                      <td className="px-4 py-2">{m.status_name ?? '—'}</td>
                      <td className="px-4 py-2">{fmtDate(m.joined_on)}</td>
                      <td className="px-4 py-2">{formatShortAddress(m)}</td>
                      <td className="px-4 py-2">{formatPhone(m)}</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        No members joined in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
