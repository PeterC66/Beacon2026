// beacon2/frontend/src/pages/groups/GroupDetails.jsx
// Details tab of the Group record (create/edit group fields).
// Extracted from GroupRecord.jsx — no behaviour change.

import { useState, useEffect, useRef } from 'react';
import { groups as groupsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import RecordTimestamp from '../../components/RecordTimestamp.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

export default function GroupDetails({
  groupId,
  faculties,
  venues,
  onSaved,
  onDeleted,
  siteworksActivated,
}) {
  const { can } = useAuth();
  const isNew = !groupId;

  const EMPTY = {
    name: '',
    shortName: '',
    facultyId: '',
    status: 'active',
    whenText: '',
    startTime: '',
    endTime: '',
    venueId: '',
    enquiries: '',
    maxMembers: '',
    allowOnlineJoin: false,
    enableWaitingList: false,
    notifyLeader: false,
    displayWaitingList: false,
    information: '',
    notes: '',
    showAddresses: false,
  };

  const { markDirty, markClean } = useUnsavedChanges();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    groupsApi
      .get(groupId)
      .then((g) => {
        setForm({
          name: g.name ?? '',
          shortName: g.short_name ?? '',
          facultyId: g.faculty_id ?? '',
          status: g.status ?? 'active',
          whenText: g.when_text ?? '',
          startTime: g.start_time ?? '',
          endTime: g.end_time ?? '',
          venueId: g.venue_id ?? '',
          enquiries: g.enquiries ?? '',
          maxMembers: g.max_members != null ? String(g.max_members) : '',
          allowOnlineJoin: g.allow_online_join ?? false,
          enableWaitingList: g.enable_waiting_list ?? false,
          notifyLeader: g.notify_leader ?? false,
          displayWaitingList: g.display_waiting_list ?? false,
          information: g.information ?? '',
          notes: g.notes ?? '',
          showAddresses: g.show_addresses ?? false,
        });
        setCreatedAt(g.created_at);
        setUpdatedAt(g.updated_at);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [groupId]);

  function set(field, value) {
    markDirty();
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        shortName: form.shortName || null,
        facultyId: form.facultyId || null,
        status: form.status,
        whenText: form.whenText || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        venueId: form.venueId || null,
        enquiries: form.enquiries || null,
        maxMembers: form.maxMembers ? parseInt(form.maxMembers, 10) : null,
        allowOnlineJoin: form.allowOnlineJoin,
        enableWaitingList: form.enableWaitingList,
        notifyLeader: form.notifyLeader,
        displayWaitingList: form.displayWaitingList,
        information: form.information || null,
        notes: form.notes || null,
        showAddresses: form.showAddresses,
      };
      let result;
      if (isNew) {
        result = await groupsApi.create(payload);
      } else {
        result = await groupsApi.update(groupId, payload);
      }
      markClean(); // must precede onSaved → navigate() so useBlocker doesn't fire
      onSaved(result);
      if (!isNew) {
        setSaved(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 3000);
      }
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

  const canChange =
    can('group_records_all', 'change') || (isNew && can('group_records_all', 'create'));
  const canDelete = !isNew && can('group_records_all', 'delete');

  const inputCls =
    'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {saved && (
        <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2">
          ✓ Saved successfully.
        </p>
      )}

      {/* Name + Abbreviated name */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-4">
        <div>
          <label htmlFor="group-name" className={labelCls}>
            Group Name <RequiredMark />
          </label>
          <input
            id="group-name"
            name="name"
            className={`${inputCls} w-full`}
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={!canChange}
          />
        </div>
        <div>
          <label htmlFor="group-short-name" className={labelCls}>
            Abbreviated name
          </label>
          <input
            id="group-short-name"
            name="shortName"
            maxLength={10}
            className={`${inputCls} w-full`}
            value={form.shortName}
            onChange={(e) => set('shortName', e.target.value)}
            disabled={!canChange}
            placeholder="max 10 chars"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Faculty */}
        <div>
          <label htmlFor="group-faculty" className={labelCls}>
            Faculty
          </label>
          <select
            id="group-faculty"
            name="facultyId"
            className={`${inputCls} w-full`}
            value={form.facultyId}
            onChange={(e) => set('facultyId', e.target.value)}
            disabled={!canChange}
          >
            <option value="">— none —</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="group-status" className={labelCls}>
            Status
          </label>
          <select
            id="group-status"
            name="status"
            className={`${inputCls} w-full`}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            disabled={isNew || !canChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {!siteworksActivated && (
        <>
          {/* When */}
          <div>
            <label htmlFor="group-when" className={labelCls}>
              When
            </label>
            <input
              id="group-when"
              name="whenText"
              className={`${inputCls} w-full`}
              placeholder="e.g. 2nd Thursday at 2:00pm"
              value={form.whenText}
              onChange={(e) => set('whenText', e.target.value)}
              disabled={!canChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start time */}
            <div>
              <label htmlFor="group-start-time" className={labelCls}>
                Start time
              </label>
              <input
                id="group-start-time"
                name="startTime"
                type="time"
                className={`${inputCls} w-full`}
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                disabled={!canChange}
              />
            </div>

            {/* End time */}
            <div>
              <label htmlFor="group-end-time" className={labelCls}>
                End time
              </label>
              <input
                id="group-end-time"
                name="endTime"
                type="time"
                className={`${inputCls} w-full`}
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                disabled={!canChange}
              />
            </div>
          </div>

          {/* Venue */}
          <div>
            <label htmlFor="group-venue" className={labelCls}>
              Venue
            </label>
            <select
              id="group-venue"
              name="venueId"
              className={`${inputCls} w-full`}
              value={form.venueId}
              onChange={(e) => set('venueId', e.target.value)}
              disabled={!canChange}
            >
              <option value="">— none —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.town ? `, ${v.town}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Enquiries */}
          <div>
            <label htmlFor="group-enquiries" className={labelCls}>
              Enquiries
            </label>
            <input
              id="group-enquiries"
              name="enquiries"
              className={`${inputCls} w-full`}
              placeholder="Name/phone for enquirers"
              value={form.enquiries}
              onChange={(e) => set('enquiries', e.target.value)}
              disabled={!canChange}
            />
          </div>
        </>
      )}

      {/* Max members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="group-max-members" className={labelCls}>
            Max members
          </label>
          <input
            id="group-max-members"
            name="maxMembers"
            type="number"
            min="1"
            className={`${inputCls} w-full`}
            value={form.maxMembers}
            onChange={(e) => set('maxMembers', e.target.value)}
            disabled={!canChange}
          />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={cbCls}
            checked={form.allowOnlineJoin}
            onChange={(e) => set('allowOnlineJoin', e.target.checked)}
            disabled={!canChange}
          />
          Allow members to join/leave online
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={cbCls}
            checked={form.enableWaitingList}
            onChange={(e) => set('enableWaitingList', e.target.checked)}
            disabled={!canChange}
          />
          Enable waiting list
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={cbCls}
            checked={form.notifyLeader}
            onChange={(e) => set('notifyLeader', e.target.checked)}
            disabled={!canChange}
          />
          Notify leader when members join/leave
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={cbCls}
            checked={form.displayWaitingList}
            onChange={(e) => set('displayWaitingList', e.target.checked)}
            disabled={!canChange}
          />
          Display waiting list by default
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={cbCls}
            checked={form.showAddresses}
            onChange={(e) => set('showAddresses', e.target.checked)}
            disabled={!canChange}
          />
          Show member addresses to group leader
        </label>
      </div>

      {/* Information */}
      {!siteworksActivated && (
        <div>
          <label htmlFor="group-information" className={labelCls}>
            Information (may be shown publicly)
          </label>
          <textarea
            id="group-information"
            name="information"
            rows={4}
            className={`${inputCls} w-full resize-y`}
            value={form.information}
            onChange={(e) => set('information', e.target.value)}
            disabled={!canChange}
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="group-notes" className={labelCls}>
          Notes (private)
        </label>
        <textarea
          id="group-notes"
          name="notes"
          rows={3}
          className={`${inputCls} w-full resize-y`}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          disabled={!canChange}
        />
      </div>

      {/* Buttons */}
      {canChange && (
        <div className="flex gap-3 items-center pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
          >
            {saving ? 'Saving…' : isNew ? 'Add Group' : 'Save Record'}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm"
            >
              Delete Group
            </button>
          )}
        </div>
      )}

      {!isNew && (
        <RecordTimestamp
          label="Group record"
          createdAt={createdAt}
          updatedAt={updatedAt}
          className="pt-3"
        />
      )}
    </form>
  );
}
