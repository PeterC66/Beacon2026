// beacon2/frontend/src/pages/groups/GroupRecord.jsx
// Group record page with Details, Members, and Schedule tabs.
// Route /groups/new → create mode (Details only, no tabs)
// Route /groups/:id → view/edit mode with Details + Members + Schedule tabs

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { groups as groupsApi, faculties as facultiesApi, members as membersApi, venues as venuesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

// ─── Details sub-component ────────────────────────────────────────────────

function GroupDetails({ groupId, faculties, onSaved, onDeleted }) {
  const { can } = useAuth();
  const isNew = !groupId;

  const EMPTY = {
    name: '', facultyId: '', status: 'active', whenText: '',
    startTime: '', endTime: '', venue: '', enquiries: '',
    maxMembers: '', allowOnlineJoin: false, enableWaitingList: false,
    notifyLeader: false, displayWaitingList: false,
    information: '', notes: '', showAddresses: false,
  };

  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    groupsApi.get(groupId)
      .then((g) => setForm({
        name:                g.name ?? '',
        facultyId:           g.faculty_id ?? '',
        status:              g.status ?? 'active',
        whenText:            g.when_text ?? '',
        startTime:           g.start_time ?? '',
        endTime:             g.end_time ?? '',
        venue:               g.venue ?? '',
        enquiries:           g.enquiries ?? '',
        maxMembers:          g.max_members != null ? String(g.max_members) : '',
        allowOnlineJoin:     g.allow_online_join ?? false,
        enableWaitingList:   g.enable_waiting_list ?? false,
        notifyLeader:        g.notify_leader ?? false,
        displayWaitingList:  g.display_waiting_list ?? false,
        information:         g.information ?? '',
        notes:               g.notes ?? '',
        showAddresses:       g.show_addresses ?? false,
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [groupId]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name:                form.name,
        facultyId:           form.facultyId || null,
        status:              form.status,
        whenText:            form.whenText || null,
        startTime:           form.startTime || null,
        endTime:             form.endTime || null,
        venue:               form.venue || null,
        enquiries:           form.enquiries || null,
        maxMembers:          form.maxMembers ? parseInt(form.maxMembers, 10) : null,
        allowOnlineJoin:     form.allowOnlineJoin,
        enableWaitingList:   form.enableWaitingList,
        notifyLeader:        form.notifyLeader,
        displayWaitingList:  form.displayWaitingList,
        information:         form.information || null,
        notes:               form.notes || null,
        showAddresses:       form.showAddresses,
      };
      let result;
      if (isNew) {
        result = await groupsApi.create(payload);
      } else {
        result = await groupsApi.update(groupId, payload);
      }
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete group "${form.name}"? This cannot be undone.`)) return;
    try {
      await groupsApi.delete(groupId);
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="text-center text-slate-500 py-8">Loading…</p>;

  const canChange = can('group_records_all', 'change') || (isNew && can('group_records_all', 'create'));
  const canDelete = !isNew && can('group_records_all', 'delete');

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Name */}
      <div>
        <label className={labelCls}>Group Name *</label>
        <input className={`${inputCls} w-full`} required value={form.name}
          onChange={(e) => set('name', e.target.value)} disabled={!canChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Faculty */}
        <div>
          <label className={labelCls}>Faculty</label>
          <select className={`${inputCls} w-full`} value={form.facultyId}
            onChange={(e) => set('facultyId', e.target.value)} disabled={!canChange}>
            <option value="">— none —</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className={labelCls}>Status</label>
          <select className={`${inputCls} w-full`} value={form.status}
            onChange={(e) => set('status', e.target.value)} disabled={isNew || !canChange}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* When */}
      <div>
        <label className={labelCls}>When</label>
        <input className={`${inputCls} w-full`} placeholder="e.g. 2nd Thursday at 2:00pm"
          value={form.whenText} onChange={(e) => set('whenText', e.target.value)} disabled={!canChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start time */}
        <div>
          <label className={labelCls}>Start time</label>
          <input type="time" className={`${inputCls} w-full`} value={form.startTime}
            onChange={(e) => set('startTime', e.target.value)} disabled={!canChange} />
        </div>

        {/* End time */}
        <div>
          <label className={labelCls}>End time</label>
          <input type="time" className={`${inputCls} w-full`} value={form.endTime}
            onChange={(e) => set('endTime', e.target.value)} disabled={!canChange} />
        </div>
      </div>

      {/* Venue */}
      <div>
        <label className={labelCls}>Venue</label>
        <input className={`${inputCls} w-full`} value={form.venue}
          onChange={(e) => set('venue', e.target.value)} disabled={!canChange} />
      </div>

      {/* Enquiries */}
      <div>
        <label className={labelCls}>Enquiries</label>
        <input className={`${inputCls} w-full`} placeholder="Name/phone for enquirers"
          value={form.enquiries} onChange={(e) => set('enquiries', e.target.value)} disabled={!canChange} />
      </div>

      {/* Max members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Max members</label>
          <input type="number" min="1" className={`${inputCls} w-full`} value={form.maxMembers}
            onChange={(e) => set('maxMembers', e.target.value)} disabled={!canChange} />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={form.allowOnlineJoin}
            onChange={(e) => set('allowOnlineJoin', e.target.checked)} disabled={!canChange} />
          Allow members to join/leave online
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={form.enableWaitingList}
            onChange={(e) => set('enableWaitingList', e.target.checked)} disabled={!canChange} />
          Enable waiting list
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={form.notifyLeader}
            onChange={(e) => set('notifyLeader', e.target.checked)} disabled={!canChange} />
          Notify leader when members join/leave
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={form.displayWaitingList}
            onChange={(e) => set('displayWaitingList', e.target.checked)} disabled={!canChange} />
          Display waiting list by default
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={form.showAddresses}
            onChange={(e) => set('showAddresses', e.target.checked)} disabled={!canChange} />
          Show member addresses to group leader
        </label>
      </div>

      {/* Information */}
      <div>
        <label className={labelCls}>Information (may be shown publicly)</label>
        <textarea rows={4} className={`${inputCls} w-full resize-y`} value={form.information}
          onChange={(e) => set('information', e.target.value)} disabled={!canChange} />
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes (private)</label>
        <textarea rows={3} className={`${inputCls} w-full resize-y`} value={form.notes}
          onChange={(e) => set('notes', e.target.value)} disabled={!canChange} />
      </div>

      {/* Buttons */}
      {canChange && (
        <div className="flex gap-3 items-center pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
            {saving ? 'Saving…' : (isNew ? 'Add Group' : 'Save Record')}
          </button>
          {canDelete && (
            <button type="button" onClick={handleDelete}
              className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm">
              Delete Group
            </button>
          )}
        </div>
      )}
    </form>
  );
}

// ─── Members sub-component ────────────────────────────────────────────────

function GroupMembers({ groupId }) {
  const { can } = useAuth();
  const [groupMembers, setGroupMembers] = useState([]);
  const [allMembers,   setAllMembers]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const [addByName,   setAddByName]   = useState('');
  const [addByNumber, setAddByNumber] = useState('');
  const [addError,    setAddError]    = useState(null);
  const [addLoading,  setAddLoading]  = useState(false);

  // Filter checkboxes
  const [showJoined,  setShowJoined]  = useState(true);
  const [showWaiting, setShowWaiting] = useState(true);

  const canManage = can('group_records_all', 'change');
  const { sorted: sortedMembers, sortKey, sortDir, onSort } = useSortedData(groupMembers);

  useEffect(() => {
    load();
    if (canManage) {
      membersApi.list({}).then(setAllMembers).catch(() => {});
    }
  }, [groupId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await groupsApi.listMembers(groupId);
      setGroupMembers(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddByName() {
    if (!addByName) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await groupsApi.addMember(groupId, { memberId: addByName });
      setAddByName('');
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAddByNumber() {
    const num = parseInt(addByNumber, 10);
    if (!num) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await groupsApi.addMember(groupId, { membershipNumber: num });
      setAddByNumber('');
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(memberId) {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await groupsApi.removeMember(groupId, memberId);
      setGroupMembers((prev) => prev.filter((m) => m.member_id !== memberId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleLeader(memberId, currentIsLeader) {
    try {
      const updated = await groupsApi.updateMember(groupId, memberId, { isLeader: !currentIsLeader });
      setGroupMembers((prev) =>
        prev.map((m) => m.member_id === updated.member_id ? { ...m, is_leader: updated.is_leader } : m),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoinGroup(memberId) {
    try {
      const updated = await groupsApi.updateMember(groupId, memberId, { waitingSince: null });
      setGroupMembers((prev) =>
        prev.map((m) => m.member_id === updated.member_id ? { ...m, waiting_since: null } : m),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  // Determine row class based on member status
  function rowStyle(m) {
    if (m.status === 'Resigned' || m.status === 'Deceased') return 'line-through text-red-500';
    if (m.status === 'Lapsed') return 'text-red-500';
    return '';
  }

  if (loading) return <p className="text-center text-slate-500 py-8">Loading…</p>;

  const joinedMembers  = sortedMembers.filter((m) => !m.waiting_since);
  const waitingMembers = sortedMembers.filter((m) => m.waiting_since);

  // Apply visibility filters
  const visibleMembers = [
    ...(showJoined  ? joinedMembers  : []),
    ...(showWaiting ? waitingMembers : []),
  ];

  const hasWaiting = waitingMembers.length > 0;

  // Compute which members can still be added (not already in group)
  const memberIdsInGroup = new Set(groupMembers.map((m) => m.member_id));
  const availableToAdd = allMembers.filter((m) => !memberIdsInGroup.has(m.id));

  const cbCls = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Filter checkboxes ──────────────────────────────────────── */}
      {hasWaiting && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={cbCls} checked={showJoined}
              onChange={(e) => setShowJoined(e.target.checked)} />
            Joined members ({joinedMembers.length})
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={cbCls} checked={showWaiting}
              onChange={(e) => setShowWaiting(e.target.checked)} />
            Waiting list ({waitingMembers.length})
          </label>
        </div>
      )}

      {/* ── Combined members table ─────────────────────────────────── */}
      {visibleMembers.length === 0 ? (
        <p className="text-slate-500 text-sm">No members to display.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm">
          <table className="w-full text-sm bg-white min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                <SortableHeader col="membership_number" label="No"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="surname"           label="Name"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="town"              label="Town"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <th className="px-3 py-2 font-normal">Email</th>
                <th className="px-3 py-2 font-normal">Tel</th>
                <SortableHeader col="status"            label="Status"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="is_leader"         label="Leader"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                {hasWaiting && (
                  <SortableHeader col="waiting_since" label="Waiting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                )}
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m, i) => (
                <tr key={m.member_id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                  <td className="px-3 py-2 tabular-nums">{m.membership_number}</td>
                  <td className={`px-3 py-2 ${rowStyle(m)}`}>
                    {m.is_leader && <span className="text-blue-600 font-medium mr-1">★</span>}
                    {m.title ? `${m.title} ` : ''}{m.forenames} {m.surname}
                    {m.known_as ? ` (${m.known_as})` : ''}
                    {!m.email && <span className="ml-2 text-red-400 text-xs" title="No email">✉✗</span>}
                  </td>
                  <td className="px-3 py-2">{m.town ?? ''}</td>
                  <td className="px-3 py-2 text-xs">{m.hide_contact ? '' : (m.email ?? '')}</td>
                  <td className="px-3 py-2 text-xs">{m.hide_contact ? '' : (m.telephone ?? m.mobile ?? '')}</td>
                  <td className="px-3 py-2">{m.status ?? ''}</td>
                  <td className="px-3 py-2">{m.is_leader ? 'Yes' : ''}</td>
                  {hasWaiting && (
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {m.waiting_since ?? ''}
                    </td>
                  )}
                  {canManage && (
                    <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                      {!m.waiting_since && (
                        <button
                          onClick={() => handleToggleLeader(m.member_id, m.is_leader)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {m.is_leader ? 'Remove leader' : 'Make leader'}
                        </button>
                      )}
                      {m.waiting_since && (
                        <button
                          onClick={() => handleJoinGroup(m.member_id)}
                          className="text-green-700 hover:underline text-xs"
                        >
                          join group
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(m.member_id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add members ───────────────────────────────────────────── */}
      {canManage && (
        <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Add a member</h3>

          {addError && <p className="text-red-600 text-sm">{addError}</p>}

          {/* By name */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Add member by name</label>
              <select
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
            <button
              onClick={handleAddByName}
              disabled={!addByName || addLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium"
            >
              Add
            </button>
          </div>

          {/* By membership number */}
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Add member by membership number</label>
              <input
                type="number"
                min="1"
                value={addByNumber}
                onChange={(e) => setAddByNumber(e.target.value)}
                placeholder="e.g. 42"
                className="border border-slate-300 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddByNumber}
              disabled={!addByNumber || addLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Schedule sub-component ───────────────────────────────────────────────

function GroupSchedule({ groupId, groupData }) {
  const { can } = useAuth();
  const [events,    setEvents]    = useState([]);
  const [venues,    setVenues]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());

  // Add-event form
  const EMPTY_EV = {
    eventDate: '', startTime: '', endTime: '', venueId: '',
    contact: '', details: '', isPrivate: false,
    repeatEvery: '', repeatUnit: 'weeks', repeatUntil: '',
  };
  const [addForm,   setAddForm]   = useState(EMPTY_EV);
  const [addError,  setAddError]  = useState(null);
  const [addSaving, setAddSaving] = useState(false);

  // Inline edit
  const [editId,    setEditId]    = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const canManage = can('group_records_all', 'change');

  useEffect(() => {
    load();
    venuesApi.list().then(setVenues).catch(() => {});
  }, [groupId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.listEvents(groupId);
      setEvents(data);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setAdd(field, value) {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addForm.eventDate) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const payload = {
        eventDate:   addForm.eventDate,
        startTime:   addForm.startTime || null,
        endTime:     addForm.endTime || null,
        venueId:     addForm.venueId || null,
        contact:     addForm.contact || null,
        details:     addForm.details || null,
        isPrivate:   addForm.isPrivate,
      };
      if (addForm.repeatEvery && addForm.repeatUntil) {
        payload.repeatEvery = parseInt(addForm.repeatEvery, 10);
        payload.repeatUnit  = addForm.repeatUnit;
        payload.repeatUntil = addForm.repeatUntil;
      }
      await groupsApi.createEvents(groupId, payload);
      setAddForm(EMPTY_EV);
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(ev) {
    setEditId(ev.id);
    setEditForm({
      eventDate: ev.event_date ?? '',
      startTime: ev.start_time ?? '',
      endTime:   ev.end_time ?? '',
      venueId:   ev.venue_id ?? '',
      contact:   ev.contact ?? '',
      details:   ev.details ?? '',
      isPrivate: ev.is_private ?? false,
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({});
    setEditError(null);
  }

  async function handleSaveEdit(evId) {
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        eventDate: editForm.eventDate || undefined,
        startTime: editForm.startTime || null,
        endTime:   editForm.endTime || null,
        venueId:   editForm.venueId || null,
        contact:   editForm.contact || null,
        details:   editForm.details || null,
        isPrivate: editForm.isPrivate,
      };
      const updated = await groupsApi.updateEvent(groupId, evId, payload);
      setEvents((prev) => prev.map((e) => e.id === evId ? { ...e, ...updated } : e));
      cancelEdit();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(events.map((e) => e.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} event(s)?`)) return;
    try {
      await groupsApi.deleteEvents(groupId, [...selected]);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  function fmtDate(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function fmtTime(t) {
    if (!t) return '';
    return t.slice(0, 5);
  }

  if (loading) return <p className="text-center text-slate-500 py-8">Loading…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Show Detail toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={showDetail}
            onChange={(e) => setShowDetail(e.target.checked)} />
          Show Detail
        </label>
      </div>

      {/* Bulk actions */}
      {canManage && events.length > 0 && (
        <div className="flex gap-3 items-center text-sm">
          <button onClick={selectAll}   className="text-blue-600 hover:underline text-xs">Select all</button>
          <button onClick={deselectAll} className="text-slate-500 hover:underline text-xs">Deselect all</button>
          {selected.size > 0 && (
            <button onClick={handleDeleteSelected}
              className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-3 py-1 text-xs">
              Delete selected ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* Events table */}
      {events.length === 0 ? (
        <p className="text-slate-500 text-sm">No events scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm">
          <table className="w-full text-sm bg-white min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                {canManage && <th className="px-3 py-2 w-8"></th>}
                <th className="px-3 py-2 font-normal">Date &amp; Time</th>
                <th className="px-3 py-2 font-normal">Venue</th>
                {showDetail && <th className="px-3 py-2 font-normal">Contact</th>}
                {showDetail && <th className="px-3 py-2 font-normal">Details</th>}
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                if (editId === ev.id) {
                  return (
                    <tr key={ev.id} className="border-b border-slate-100 bg-blue-50">
                      {canManage && <td className="px-3 py-2"></td>}
                      <td className="px-3 py-2" colSpan={showDetail ? 4 : 2}>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className={labelCls}>Date *</label>
                            <input type="date" className={inputCls} value={editForm.eventDate}
                              onChange={(e) => setEditForm((p) => ({ ...p, eventDate: e.target.value }))} />
                          </div>
                          <div>
                            <label className={labelCls}>Start</label>
                            <input type="time" className={inputCls} value={editForm.startTime}
                              onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))} />
                          </div>
                          <div>
                            <label className={labelCls}>End</label>
                            <input type="time" className={inputCls} value={editForm.endTime}
                              onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))} />
                          </div>
                          <div>
                            <label className={labelCls}>Venue</label>
                            <select className={inputCls} value={editForm.venueId}
                              onChange={(e) => setEditForm((p) => ({ ...p, venueId: e.target.value }))}>
                              <option value="">— none —</option>
                              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Contact</label>
                            <input className={inputCls} value={editForm.contact}
                              onChange={(e) => setEditForm((p) => ({ ...p, contact: e.target.value }))} />
                          </div>
                          <div className="flex-1 min-w-48">
                            <label className={labelCls}>Details</label>
                            <input className={`${inputCls} w-full`} value={editForm.details}
                              onChange={(e) => setEditForm((p) => ({ ...p, details: e.target.value }))} />
                          </div>
                          <label className="flex items-center gap-1 text-xs cursor-pointer mt-4">
                            <input type="checkbox" className={cbCls} checked={editForm.isPrivate}
                              onChange={(e) => setEditForm((p) => ({ ...p, isPrivate: e.target.checked }))} />
                            Private
                          </label>
                        </div>
                        {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleSaveEdit(ev.id)} disabled={editSaving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1 text-xs">
                            {editSaving ? 'Saving…' : 'Update'}
                          </button>
                          <button onClick={cancelEdit}
                            className="border border-slate-300 rounded px-3 py-1 text-xs hover:bg-slate-50">
                            Cancel
                          </button>
                        </div>
                      </td>
                      {canManage && <td></td>}
                    </tr>
                  );
                }

                return (
                  <tr key={ev.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                    {canManage && (
                      <td className="px-3 py-2">
                        <input type="checkbox" className={cbCls}
                          checked={selected.has(ev.id)}
                          onChange={() => toggleSelect(ev.id)} />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {canManage ? (
                        <button onClick={() => startEdit(ev)}
                          className="text-blue-700 hover:underline text-left">
                          {fmtDate(ev.event_date)}
                          {ev.start_time ? ` ${fmtTime(ev.start_time)}` : ''}
                          {ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}
                        </button>
                      ) : (
                        <span>
                          {fmtDate(ev.event_date)}
                          {ev.start_time ? ` ${fmtTime(ev.start_time)}` : ''}
                          {ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}
                        </span>
                      )}
                      {ev.is_private && <span className="ml-2 text-xs text-slate-400">(private)</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {ev.venue_name ?? ''}
                    </td>
                    {showDetail && <td className="px-3 py-2 text-slate-600">{ev.contact ?? ''}</td>}
                    {showDetail && <td className="px-3 py-2 text-slate-600">{ev.details ?? ''}</td>}
                    {canManage && <td className="px-3 py-2 text-right"></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new event form */}
      {canManage && (
        <div className="bg-white/90 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Events</h3>
          {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}

          <form onSubmit={handleAdd} noValidate className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className={labelCls}>First date &amp; time *</label>
                <input type="date" className={inputCls} required value={addForm.eventDate}
                  onChange={(e) => setAdd('eventDate', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Start time</label>
                <input type="time" className={inputCls} value={addForm.startTime}
                  onChange={(e) => setAdd('startTime', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>End time</label>
                <input type="time" className={inputCls} value={addForm.endTime}
                  onChange={(e) => setAdd('endTime', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Venue</label>
                <select className={inputCls} value={addForm.venueId}
                  onChange={(e) => setAdd('venueId', e.target.value)}>
                  <option value="">— none —</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className={labelCls}>Contact</label>
                <input className={inputCls} value={addForm.contact}
                  onChange={(e) => setAdd('contact', e.target.value)} />
              </div>
              <div className="flex-1 min-w-48">
                <label className={labelCls}>Details</label>
                <input className={`${inputCls} w-full`} value={addForm.details}
                  onChange={(e) => setAdd('details', e.target.value)} />
              </div>
              <label className="flex items-center gap-1 text-xs cursor-pointer mt-4">
                <input type="checkbox" className={cbCls} checked={addForm.isPrivate}
                  onChange={(e) => setAdd('isPrivate', e.target.checked)} />
                Exclude from public calendar
              </label>
            </div>

            {/* Recurrence */}
            <div className="flex flex-wrap gap-3 items-end border-t border-slate-200 pt-3">
              <span className="text-sm text-slate-600 self-end pb-2">then every</span>
              <div>
                <label className={labelCls}>Count</label>
                <input type="number" min="1" className={`${inputCls} w-20`} value={addForm.repeatEvery}
                  placeholder="—"
                  onChange={(e) => setAdd('repeatEvery', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <select className={inputCls} value={addForm.repeatUnit}
                  onChange={(e) => setAdd('repeatUnit', e.target.value)}>
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Until</label>
                <input type="date" className={inputCls} value={addForm.repeatUntil}
                  onChange={(e) => setAdd('repeatUntil', e.target.value)} />
              </div>
            </div>

            <div className="pt-1">
              <button type="submit" disabled={addSaving || !addForm.eventDate}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                {addSaving ? 'Adding…' : 'Add Events'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── GroupRecord page ─────────────────────────────────────────────────────

export default function GroupRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, tenant } = useAuth();
  const [faculties, setFaculties] = useState([]);
  const [groupName, setGroupName] = useState('');

  const isNew = id === undefined;
  const activeTab = searchParams.get('tab') ?? 'details';

  useEffect(() => {
    facultiesApi.list().then(setFaculties).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew) {
      groupsApi.get(id)
        .then((g) => setGroupName(g.name))
        .catch(() => {});
    }
  }, [id]);

  function handleSaved(result) {
    if (isNew) {
      navigate(`/groups/${result.id}`);
    } else {
      setGroupName(result.name ?? groupName);
    }
  }

  function handleDeleted() {
    navigate('/groups');
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Groups', to: '/groups' },
    ...(can('group_records_all', 'create') ? [{ label: 'Add New Group', to: '/groups/new' }] : []),
  ];

  const tabs = [
    { key: 'details',  label: 'Details',  available: true },
    { key: 'members',  label: 'Members',  available: !isNew },
    { key: 'schedule', label: 'Schedule', available: !isNew },
    { key: 'ledger',   label: 'Ledger',   available: false },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Title */}
        <h1 className="text-xl font-bold text-center mb-3">
          {isNew ? 'Add New Group' : (groupName || 'Group Record')}
        </h1>

        {/* Tab navigation (only when editing existing) */}
        {!isNew && (
          <div className="flex gap-0 mb-4 border-b border-slate-300">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                disabled={!tab.available}
                onClick={() => tab.available && setSearchParams(tab.key === 'details' ? {} : { tab: tab.key })}
                className={[
                  'px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab.available && activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : tab.available
                    ? 'border-transparent text-slate-600 hover:text-slate-900'
                    : 'border-transparent text-slate-300 cursor-not-allowed',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
          {(isNew || activeTab === 'details') && (
            <GroupDetails
              groupId={isNew ? null : id}
              faculties={faculties}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          )}
          {!isNew && activeTab === 'members' && (
            <GroupMembers groupId={id} />
          )}
          {!isNew && activeTab === 'schedule' && (
            <GroupSchedule groupId={id} />
          )}
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
