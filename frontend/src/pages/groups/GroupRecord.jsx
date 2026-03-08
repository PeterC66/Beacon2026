// beacon2/frontend/src/pages/groups/GroupRecord.jsx
// Group record page with Details and Members tabs.
// Route /groups/new → create mode (Details only, no tabs)
// Route /groups/:id → view/edit mode with Details + Members tabs

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { groups as groupsApi, faculties as facultiesApi, members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

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

  const canManage = can('group_records_all', 'change');

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

  // Determine row class based on member status
  function rowStyle(m) {
    if (m.status === 'Resigned' || m.status === 'Deceased') return 'line-through text-red-500';
    if (m.status === 'Lapsed') return 'text-red-500';
    return '';
  }

  if (loading) return <p className="text-center text-slate-500 py-8">Loading…</p>;

  const joinedMembers  = groupMembers.filter((m) => !m.waiting_since);
  const waitingMembers = groupMembers.filter((m) => m.waiting_since);

  // Compute which members can still be added (not already in group)
  const memberIdsInGroup = new Set(groupMembers.map((m) => m.member_id));
  const availableToAdd = allMembers.filter((m) => !memberIdsInGroup.has(m.id));

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Members table ──────────────────────────────────────────── */}
      {joinedMembers.length === 0 ? (
        <p className="text-slate-500 text-sm">No members in this group yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm">
          <table className="w-full text-sm bg-white min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                <th className="px-3 py-2 font-normal">No</th>
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">Town</th>
                <th className="px-3 py-2 font-normal">Email</th>
                <th className="px-3 py-2 font-normal">Tel</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal">Leader</th>
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {joinedMembers.map((m, i) => (
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
                  {canManage && (
                    <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleLeader(m.member_id, m.is_leader)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        {m.is_leader ? 'Remove leader' : 'Make leader'}
                      </button>
                      <button
                        onClick={() => handleRemove(m.member_id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Waiting list ──────────────────────────────────────────── */}
      {waitingMembers.length > 0 && (
        <details className="bg-white/90 rounded-lg shadow-sm p-3">
          <summary className="text-sm font-medium cursor-pointer">
            Waiting list ({waitingMembers.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {waitingMembers.map((m) => (
              <li key={m.member_id} className="text-sm text-slate-600 flex justify-between">
                <span>{m.forenames} {m.surname} — waiting since {m.waiting_since}</span>
                {canManage && (
                  <button onClick={() => handleRemove(m.member_id)}
                    className="text-red-600 hover:underline text-xs ml-3">Remove</button>
                )}
              </li>
            ))}
          </ul>
        </details>
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
    { key: 'schedule', label: 'Schedule', available: false },
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
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
