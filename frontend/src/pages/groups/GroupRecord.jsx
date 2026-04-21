// beacon2/frontend/src/pages/groups/GroupRecord.jsx
// Group record page with Details, Members, and Schedule tabs.
// Route /groups/new → create mode (Details only, no tabs)
// Route /groups/:id → view/edit mode with Details + Members + Schedule tabs

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { groups as groupsApi, faculties as facultiesApi, venues as venuesApi, requestBlob } from '../../lib/api.js';
import Schedule from '../../components/Schedule.jsx';
import EntityMembers from '../../components/EntityMembers.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import RecordTimestamp from '../../components/RecordTimestamp.jsx';

// ─── Details sub-component ────────────────────────────────────────────────

function GroupDetails({ groupId, faculties, venues, onSaved, onDeleted, siteworksActivated }) {
  const { can } = useAuth();
  const isNew = !groupId;

  const EMPTY = {
    name: '', shortName: '', facultyId: '', status: 'active', whenText: '',
    startTime: '', endTime: '', venueId: '', enquiries: '',
    maxMembers: '', allowOnlineJoin: false, enableWaitingList: false,
    notifyLeader: false, displayWaitingList: false,
    information: '', notes: '', showAddresses: false,
  };

  const { markDirty, markClean } = useUnsavedChanges();

  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(false);
  const savedTimer = useRef(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    groupsApi.get(groupId)
      .then((g) => {
        setForm({
          name:                g.name ?? '',
          shortName:           g.short_name ?? '',
          facultyId:           g.faculty_id ?? '',
          status:              g.status ?? 'active',
          whenText:            g.when_text ?? '',
          startTime:           g.start_time ?? '',
          endTime:             g.end_time ?? '',
          venueId:             g.venue_id ?? '',
          enquiries:           g.enquiries ?? '',
          maxMembers:          g.max_members != null ? String(g.max_members) : '',
          allowOnlineJoin:     g.allow_online_join ?? false,
          enableWaitingList:   g.enable_waiting_list ?? false,
          notifyLeader:        g.notify_leader ?? false,
          displayWaitingList:  g.display_waiting_list ?? false,
          information:         g.information ?? '',
          notes:               g.notes ?? '',
          showAddresses:       g.show_addresses ?? false,
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
        name:                form.name,
        shortName:           form.shortName || null,
        facultyId:           form.facultyId || null,
        status:              form.status,
        whenText:            form.whenText || null,
        startTime:           form.startTime || null,
        endTime:             form.endTime || null,
        venueId:             form.venueId || null,
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
      markClean();          // must precede onSaved → navigate() so useBlocker doesn't fire
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

  const canChange = can('group_records_all', 'change') || (isNew && can('group_records_all', 'create'));
  const canDelete = !isNew && can('group_records_all', 'delete');

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

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
          <label htmlFor="group-name" className={labelCls}>Group Name <RequiredMark /></label>
          <input id="group-name" name="name" className={`${inputCls} w-full`} required value={form.name}
            onChange={(e) => set('name', e.target.value)} disabled={!canChange} />
        </div>
        <div>
          <label htmlFor="group-short-name" className={labelCls}>Abbreviated name</label>
          <input id="group-short-name" name="shortName" maxLength={10} className={`${inputCls} w-full`} value={form.shortName}
            onChange={(e) => set('shortName', e.target.value)} disabled={!canChange} placeholder="max 10 chars" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Faculty */}
        <div>
          <label htmlFor="group-faculty" className={labelCls}>Faculty</label>
          <select id="group-faculty" name="facultyId" className={`${inputCls} w-full`} value={form.facultyId}
            onChange={(e) => set('facultyId', e.target.value)} disabled={!canChange}>
            <option value="">— none —</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="group-status" className={labelCls}>Status</label>
          <select id="group-status" name="status" className={`${inputCls} w-full`} value={form.status}
            onChange={(e) => set('status', e.target.value)} disabled={isNew || !canChange}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {!siteworksActivated && (<>
        {/* When */}
        <div>
          <label htmlFor="group-when" className={labelCls}>When</label>
          <input id="group-when" name="whenText" className={`${inputCls} w-full`} placeholder="e.g. 2nd Thursday at 2:00pm"
            value={form.whenText} onChange={(e) => set('whenText', e.target.value)} disabled={!canChange} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Start time */}
          <div>
            <label htmlFor="group-start-time" className={labelCls}>Start time</label>
            <input id="group-start-time" name="startTime" type="time" className={`${inputCls} w-full`} value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)} disabled={!canChange} />
          </div>

          {/* End time */}
          <div>
            <label htmlFor="group-end-time" className={labelCls}>End time</label>
            <input id="group-end-time" name="endTime" type="time" className={`${inputCls} w-full`} value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)} disabled={!canChange} />
          </div>
        </div>

        {/* Venue */}
        <div>
          <label htmlFor="group-venue" className={labelCls}>Venue</label>
          <select id="group-venue" name="venueId" className={`${inputCls} w-full`} value={form.venueId}
            onChange={(e) => set('venueId', e.target.value)} disabled={!canChange}>
            <option value="">— none —</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.town ? `, ${v.town}` : ''}</option>)}
          </select>
        </div>

        {/* Enquiries */}
        <div>
          <label htmlFor="group-enquiries" className={labelCls}>Enquiries</label>
          <input id="group-enquiries" name="enquiries" className={`${inputCls} w-full`} placeholder="Name/phone for enquirers"
            value={form.enquiries} onChange={(e) => set('enquiries', e.target.value)} disabled={!canChange} />
        </div>
      </>)}

      {/* Max members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="group-max-members" className={labelCls}>Max members</label>
          <input id="group-max-members" name="maxMembers" type="number" min="1" className={`${inputCls} w-full`} value={form.maxMembers}
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
      {!siteworksActivated && (
        <div>
          <label htmlFor="group-information" className={labelCls}>Information (may be shown publicly)</label>
          <textarea id="group-information" name="information" rows={4} className={`${inputCls} w-full resize-y`} value={form.information}
            onChange={(e) => set('information', e.target.value)} disabled={!canChange} />
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="group-notes" className={labelCls}>Notes (private)</label>
        <textarea id="group-notes" name="notes" rows={3} className={`${inputCls} w-full resize-y`} value={form.notes}
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

      {!isNew && <RecordTimestamp label="Group record" createdAt={createdAt} updatedAt={updatedAt} className="pt-3" />}
    </form>
  );
}

// ─── Members sub-component (shared — see components/EntityMembers.jsx) ───

// ─── Schedule sub-component (shared — see components/Schedule.jsx) ───────


// ─── GroupLedger sub-component ────────────────────────────────────────────

function GroupLedger({ groupId }) {
  const { can } = useAuth();
  const navigate = useNavigate();

  const thisYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${thisYear}-01-01`);
  const [toDate,   setToDate]   = useState(`${thisYear}-12-31`);

  const [broughtForward, setBroughtForward] = useState(0);
  const [entries,        setEntries]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  // Add form
  const EMPTY_ENTRY = { entryDate: '', payee: '', detail: '', moneyIn: '', moneyOut: '' };
  const [addForm,    setAddForm]    = useState(EMPTY_ENTRY);
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState(null);

  // Inline edit
  const [editId,     setEditId]     = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState(null);

  const canChange   = can('group_ledger_all', 'change')   || can('group_ledger_as_leader', 'change');
  const canCreate   = can('group_ledger_all', 'create')   || can('group_ledger_as_leader', 'create');
  const canDelete   = can('group_ledger_all', 'delete')   || can('group_ledger_as_leader', 'delete');
  const canDownload = can('group_ledger_all', 'download') || can('group_ledger_as_leader', 'download');

  useEffect(() => { load(); }, [groupId, fromDate, toDate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.getLedger(groupId, { from: fromDate, to: toDate });
      setBroughtForward(parseFloat(data.broughtForward) || 0);
      setEntries(data.entries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fmtDate(d) {
    if (!d) return '';
    const s = String(d).slice(0, 10);
    const [y, m, day] = s.split('-');
    return `${day}/${m}/${y}`;
  }

  function fmtAmt(v) {
    if (v == null || v === '') return '';
    const n = parseFloat(v);
    return isNaN(n) ? '' : n.toFixed(2);
  }

  // Running balance across rows
  function computeRows() {
    let balance = broughtForward;
    return entries.map((e) => {
      const inn  = parseFloat(e.money_in)  || 0;
      const out  = parseFloat(e.money_out) || 0;
      balance += inn - out;
      return { ...e, _balance: balance };
    });
  }

  function startEdit(entry) {
    setEditId(entry.id);
    setEditForm({
      entryDate: entry.entry_date ? String(entry.entry_date).slice(0, 10) : '',
      payee:     entry.payee   ?? '',
      detail:    entry.detail  ?? '',
      moneyIn:   entry.money_in  != null ? String(entry.money_in)  : '',
      moneyOut:  entry.money_out != null ? String(entry.money_out) : '',
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({});
    setEditError(null);
  }

  async function handleSaveEdit(entryId) {
    setEditSaving(true);
    setEditError(null);
    try {
      await groupsApi.updateLedgerEntry(groupId, entryId, {
        entryDate: editForm.entryDate || undefined,
        payee:     editForm.payee     || null,
        detail:    editForm.detail    || null,
        moneyIn:   editForm.moneyIn   ? parseFloat(editForm.moneyIn)  : null,
        moneyOut:  editForm.moneyOut  ? parseFloat(editForm.moneyOut) : null,
      });
      cancelEdit();
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(entryId) {
    if (!window.confirm('Delete this ledger entry?')) return;
    try {
      await groupsApi.deleteLedgerEntry(groupId, entryId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addForm.entryDate) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await groupsApi.createLedgerEntry(groupId, {
        entryDate: addForm.entryDate,
        payee:     addForm.payee     || null,
        detail:    addForm.detail    || null,
        moneyIn:   addForm.moneyIn   ? parseFloat(addForm.moneyIn)  : null,
        moneyOut:  addForm.moneyOut  ? parseFloat(addForm.moneyOut) : null,
      });
      setAddForm(EMPTY_ENTRY);
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDownload() {
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate });
      await requestBlob(`/groups/${groupId}/ledger/download?${qs}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-0.5';

  const rows = computeRows();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Group Cash</h2>
      <p className="text-xs text-slate-600 mb-3">
        The group's own cash record — not linked to the u3a's central accounts.
        The Finance Ledger shows different, complementary transactions.
      </p>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium mb-3">
          {error}
        </p>
      )}

      {/* Date range filter */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label htmlFor="ledger-from-date" className={labelCls}>From</label>
          <input id="ledger-from-date" name="fromDate" type="date" className={inputCls} value={fromDate}
            onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ledger-to-date" className={labelCls}>To</label>
          <input id="ledger-to-date" name="toDate" type="date" className={inputCls} value={toDate}
            onChange={(e) => setToDate(e.target.value)} />
        </div>
        {canDownload && (
          <button onClick={handleDownload}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm">
            Download Excel
          </button>
        )}
        {can('finance_transactions', 'view') && (
          <button
            type="button"
            onClick={() => navigate(`/finance/ledger?view=group&groupId=${groupId}`)}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm"
            title="View this group's other transactions - in the central ledger"
          >
            Central Ledger
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">Date</th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">Payee</th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">Detail</th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200 text-right">In (£)</th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200 text-right">Out (£)</th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200 text-right">Balance (£)</th>
                {(canChange || canDelete) && (
                  <th className="px-3 py-2 border-b border-slate-200"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Brought Forward row */}
              <tr className="bg-yellow-50">
                <td className="px-3 py-1.5 border-b border-slate-100 font-medium text-slate-600" colSpan={3}>
                  Brought Forward
                </td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right"></td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right"></td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right font-medium">
                  {broughtForward.toFixed(2)}
                </td>
                {(canChange || canDelete) && <td className="px-3 py-1.5 border-b border-slate-100"></td>}
              </tr>

              {rows.length === 0 && (
                <tr>
                  <td colSpan={canChange || canDelete ? 7 : 6}
                    className="px-3 py-4 text-center text-slate-400 text-sm">
                    No transactions in this period.
                  </td>
                </tr>
              )}

              {rows.map((entry, i) => (
                editId === entry.id ? (
                  <tr key={entry.id} className="bg-blue-50">
                    <td className="px-2 py-1 border-b border-slate-100" colSpan={canChange || canDelete ? 7 : 6}>
                      <div className="flex flex-wrap gap-2 items-end">
                        <div>
                          <label htmlFor="ledger-edit-date" className={labelCls}>Date</label>
                          <input id="ledger-edit-date" name="entryDate" type="date" className={inputCls} value={editForm.entryDate}
                            onChange={(e) => setEditForm((p) => ({ ...p, entryDate: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-32">
                          <label htmlFor="ledger-edit-payee" className={labelCls}>Payee</label>
                          <input id="ledger-edit-payee" name="payee" className={`${inputCls} w-full`} value={editForm.payee}
                            onChange={(e) => setEditForm((p) => ({ ...p, payee: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-40">
                          <label htmlFor="ledger-edit-detail" className={labelCls}>Detail</label>
                          <input id="ledger-edit-detail" name="detail" className={`${inputCls} w-full`} value={editForm.detail}
                            onChange={(e) => setEditForm((p) => ({ ...p, detail: e.target.value }))} />
                        </div>
                        <div className="w-24">
                          <label htmlFor="ledger-edit-money-in" className={labelCls}>In (£)</label>
                          <input id="ledger-edit-money-in" name="moneyIn" type="number" min="0" step="0.01" className={inputCls}
                            value={editForm.moneyIn}
                            onChange={(e) => setEditForm((p) => ({ ...p, moneyIn: e.target.value, moneyOut: '' }))} />
                        </div>
                        <div className="w-24">
                          <label htmlFor="ledger-edit-money-out" className={labelCls}>Out (£)</label>
                          <input id="ledger-edit-money-out" name="moneyOut" type="number" min="0" step="0.01" className={inputCls}
                            value={editForm.moneyOut}
                            onChange={(e) => setEditForm((p) => ({ ...p, moneyOut: e.target.value, moneyIn: '' }))} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(entry.id)} disabled={editSaving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1.5 text-sm">
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit}
                            className="border border-slate-300 text-slate-600 hover:bg-slate-50 rounded px-3 py-1.5 text-sm">
                            Cancel
                          </button>
                        </div>
                        {editError && <span className="text-red-600 text-sm">{editError}</span>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                    <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">{fmtDate(entry.entry_date)}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100">{entry.payee ?? ''}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100">{entry.detail ?? ''}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100 text-right">{fmtAmt(entry.money_in)}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100 text-right">{fmtAmt(entry.money_out)}</td>
                    <td className="px-3 py-1.5 border-b border-slate-100 text-right font-medium">{entry._balance.toFixed(2)}</td>
                    {(canChange || canDelete) && (
                      <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                        {canChange && (
                          <button onClick={() => startEdit(entry)}
                            className="text-blue-600 hover:underline text-sm mr-3">edit</button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(entry.id)}
                            className="text-red-600 hover:underline text-sm">delete</button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add transaction form */}
      {canCreate && (
        <form onSubmit={handleAdd} className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Detail</h3>
          {addError && (
            <p className="text-red-600 text-sm mb-2">{addError}</p>
          )}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor="ledger-add-date" className={labelCls}>Date <RequiredMark /></label>
              <input id="ledger-add-date" name="entryDate" type="date" required className={inputCls} value={addForm.entryDate}
                onChange={(e) => setAddForm((p) => ({ ...p, entryDate: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-32">
              <label htmlFor="ledger-add-payee" className={labelCls}>Payee</label>
              <input id="ledger-add-payee" name="payee" className={`${inputCls} w-full`} value={addForm.payee}
                onChange={(e) => setAddForm((p) => ({ ...p, payee: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-40">
              <label htmlFor="ledger-add-detail" className={labelCls}>Detail</label>
              <input id="ledger-add-detail" name="detail" className={`${inputCls} w-full`} value={addForm.detail}
                onChange={(e) => setAddForm((p) => ({ ...p, detail: e.target.value }))} />
            </div>
            <div className="w-24">
              <label htmlFor="ledger-add-money-in" className={labelCls}>In (£)</label>
              <input id="ledger-add-money-in" name="moneyIn" type="number" min="0" step="0.01" className={inputCls}
                value={addForm.moneyIn}
                onChange={(e) => setAddForm((p) => ({ ...p, moneyIn: e.target.value, moneyOut: '' }))} />
            </div>
            <div className="w-24">
              <label htmlFor="ledger-add-money-out" className={labelCls}>Out (£)</label>
              <input id="ledger-add-money-out" name="moneyOut" type="number" min="0" step="0.01" className={inputCls}
                value={addForm.moneyOut}
                onChange={(e) => setAddForm((p) => ({ ...p, moneyOut: e.target.value, moneyIn: '' }))} />
            </div>
            <button type="submit" disabled={addSaving || !addForm.entryDate}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
              {addSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── GroupRecord page ─────────────────────────────────────────────────────

export default function GroupRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, tenant, hasFeature } = useAuth();
  const [faculties, setFaculties] = useState([]);
  const [allVenues, setAllVenues] = useState([]);
  const [groupName, setGroupName] = useState('');

  const siteworksActivated = hasFeature('siteworks');
  const isNew = id === undefined;
  const activeTab = searchParams.get('tab') ?? 'details';

  useEffect(() => {
    facultiesApi.list().then(setFaculties).catch(() => {});
    venuesApi.list().then(setAllVenues).catch(() => {});
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
    { key: 'schedule', label: 'Events',     available: !isNew && !siteworksActivated && hasFeature('events') },
    { key: 'ledger',   label: 'Group Cash', available: !isNew && hasFeature('groupLedger') && (can('group_ledger_all', 'view') || can('group_ledger_as_leader', 'view')) },
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
          <div role="tablist" className="flex gap-0 mb-4 border-b border-slate-300">
            {tabs.filter((tab) => tab.available).map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setSearchParams(tab.key === 'details' ? {} : { tab: tab.key })}
                className={[
                  'px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900',
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
              venues={allVenues}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              siteworksActivated={siteworksActivated}
            />
          )}
          {!isNew && activeTab === 'members' && (
            <EntityMembers entityId={id} api={groupsApi} entityType="group" />
          )}
          {!isNew && activeTab === 'schedule' && !siteworksActivated && (
            <Schedule entityId={id} api={groupsApi} />
          )}
          {!isNew && activeTab === 'ledger' && (
            <GroupLedger groupId={id} />
          )}
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
