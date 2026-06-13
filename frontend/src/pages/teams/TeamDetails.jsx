// beacon2/frontend/src/pages/teams/TeamDetails.jsx
// Details tab of the Team record (create/edit team fields).
// Extracted from TeamRecord.jsx — no behaviour change.

import { useState, useEffect, useRef } from 'react';
import { teams as teamsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import RecordTimestamp from '../../components/RecordTimestamp.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

export default function TeamDetails({ teamId, onSaved, onDeleted }) {
  const { can } = useAuth();
  const isNew = !teamId;

  const EMPTY = {
    name: '',
    shortName: '',
    status: 'active',
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
    if (!teamId) return;
    setLoading(true);
    teamsApi
      .get(teamId)
      .then((t) => {
        setForm({
          name: t.name ?? '',
          shortName: t.short_name ?? '',
          status: t.status ?? 'active',
          information: t.information ?? '',
          notes: t.notes ?? '',
          showAddresses: t.show_addresses ?? false,
        });
        setCreatedAt(t.created_at);
        setUpdatedAt(t.updated_at);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teamId]);

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
        status: form.status,
        information: form.information || null,
        notes: form.notes || null,
        showAddresses: form.showAddresses,
      };
      let result;
      if (isNew) {
        result = await teamsApi.create(payload);
      } else {
        result = await teamsApi.update(teamId, payload);
      }
      markClean();
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
    if (!window.confirm(`Delete team "${form.name}"? This cannot be undone.`)) return;
    try {
      await teamsApi.delete(teamId);
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
          <label htmlFor="team-name" className={labelCls}>
            Team Name <RequiredMark />
          </label>
          <input
            id="team-name"
            name="name"
            className={`${inputCls} w-full`}
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={!canChange}
          />
        </div>
        <div>
          <label htmlFor="team-short-name" className={labelCls}>
            Abbreviated name
          </label>
          <input
            id="team-short-name"
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

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="team-status" className={labelCls}>
            Status
          </label>
          <select
            id="team-status"
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

      {/* Checkboxes */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className={cbCls}
            checked={form.showAddresses}
            onChange={(e) => set('showAddresses', e.target.checked)}
            disabled={!canChange}
          />
          Show member addresses to team leader
        </label>
      </div>

      {/* Information */}
      <div>
        <label htmlFor="team-information" className={labelCls}>
          Information
        </label>
        <textarea
          id="team-information"
          name="information"
          rows={4}
          className={`${inputCls} w-full resize-y`}
          value={form.information}
          onChange={(e) => set('information', e.target.value)}
          disabled={!canChange}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="team-notes" className={labelCls}>
          Notes (private)
        </label>
        <textarea
          id="team-notes"
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
            {saving ? 'Saving…' : isNew ? 'Add Team' : 'Save Record'}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm"
            >
              Delete Team
            </button>
          )}
        </div>
      )}

      {!isNew && (
        <RecordTimestamp
          label="Team record"
          createdAt={createdAt}
          updatedAt={updatedAt}
          className="pt-3"
        />
      )}
    </form>
  );
}
