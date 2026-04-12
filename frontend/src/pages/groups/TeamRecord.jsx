// beacon2/frontend/src/pages/groups/TeamRecord.jsx
// Team record page with Details, Members, and Ledger tabs.
// Route /teams/new → create mode (Details only, no tabs)
// Route /teams/:id → view/edit mode with Details + Members + Ledger tabs

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { teams as teamsApi, members as membersApi, requestBlob } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import RecordTimestamp from '../../components/RecordTimestamp.jsx';
import NoEmailIcon from '../../components/NoEmailIcon.jsx';
import { formatShortAddress, isSubscriptionOverdue } from '../../lib/memberFormatters.js';
import { formatMemberName } from '../../hooks/usePreferences.js';

// ─── Details sub-component ────────────────────────────────────────────────

function TeamDetails({ teamId, onSaved, onDeleted }) {
  const { can } = useAuth();
  const isNew = !teamId;

  const EMPTY = {
    name: '', shortName: '', status: 'active', information: '', notes: '', showAddresses: false,
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
    if (!teamId) return;
    setLoading(true);
    teamsApi.get(teamId)
      .then((t) => {
        setForm({
          name:           t.name ?? '',
          shortName:      t.short_name ?? '',
          status:         t.status ?? 'active',
          information:    t.information ?? '',
          notes:          t.notes ?? '',
          showAddresses:  t.show_addresses ?? false,
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
        name:          form.name,
        shortName:     form.shortName || null,
        status:        form.status,
        information:   form.information || null,
        notes:         form.notes || null,
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
          <label htmlFor="team-name" className={labelCls}>Team Name <RequiredMark /></label>
          <input id="team-name" name="name" className={`${inputCls} w-full`} required value={form.name}
            onChange={(e) => set('name', e.target.value)} disabled={!canChange} />
        </div>
        <div>
          <label htmlFor="team-short-name" className={labelCls}>Abbreviated name</label>
          <input id="team-short-name" name="shortName" maxLength={10} className={`${inputCls} w-full`} value={form.shortName}
            onChange={(e) => set('shortName', e.target.value)} disabled={!canChange} placeholder="max 10 chars" />
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="team-status" className={labelCls}>Status</label>
          <select id="team-status" name="status" className={`${inputCls} w-full`} value={form.status}
            onChange={(e) => set('status', e.target.value)} disabled={isNew || !canChange}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={form.showAddresses}
            onChange={(e) => set('showAddresses', e.target.checked)} disabled={!canChange} />
          Show member addresses to team leader
        </label>
      </div>

      {/* Information */}
      <div>
        <label htmlFor="team-information" className={labelCls}>Information</label>
        <textarea id="team-information" name="information" rows={4} className={`${inputCls} w-full resize-y`} value={form.information}
          onChange={(e) => set('information', e.target.value)} disabled={!canChange} />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="team-notes" className={labelCls}>Notes (private)</label>
        <textarea id="team-notes" name="notes" rows={3} className={`${inputCls} w-full resize-y`} value={form.notes}
          onChange={(e) => set('notes', e.target.value)} disabled={!canChange} />
      </div>

      {/* Buttons */}
      {canChange && (
        <div className="flex gap-3 items-center pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
            {saving ? 'Saving…' : (isNew ? 'Add Team' : 'Save Record')}
          </button>
          {canDelete && (
            <button type="button" onClick={handleDelete}
              className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm">
              Delete Team
            </button>
          )}
        </div>
      )}

      {!isNew && <RecordTimestamp label="Team record" createdAt={createdAt} updatedAt={updatedAt} className="pt-3" />}
    </form>
  );
}

// ─── Members sub-component ────────────────────────────────────────────────

const TEAM_DL_FIELDS = [
  { key: 'membership_number', label: 'Membership No', default: true },
  { key: 'title',             label: 'Title',         default: false },
  { key: 'forenames',         label: 'Forenames',     default: true },
  { key: 'known_as',          label: 'Known As',      default: false },
  { key: 'surname',           label: 'Surname',       default: true },
  { key: 'email',             label: 'Email',         default: true },
  { key: 'mobile',            label: 'Mobile',        default: true },
  { key: 'telephone',         label: 'Telephone',     default: false },
  { key: 'address',           label: 'Address',       default: false },
  { key: 'town',              label: 'Town',          default: true },
  { key: 'postcode',          label: 'Postcode',      default: true },
  { key: 'status',            label: 'Status',        default: true },
  { key: 'is_leader',         label: 'Leader',        default: false },
];

function TeamMembers({ teamId }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState([]);
  const [allMembers,  setAllMembers]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const tableRef = useRef(null);
  const [addByName,   setAddByName]   = useState('');
  const [addByNumber, setAddByNumber] = useState('');
  const [addError,    setAddError]    = useState(null);
  const [addLoading,  setAddLoading]  = useState(false);

  const [selected,    setSelected]    = useState(new Set());
  const [bulkAction,  setBulkAction]  = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkResult,  setBulkResult]  = useState(null);
  const [dlFields,    setDlFields]    = useState(new Set(TEAM_DL_FIELDS.filter((f) => f.default).map((f) => f.key)));
  const [allTeams,    setAllTeams]    = useState([]);
  const [targetTeamId, setTargetTeamId] = useState('');

  const canManage = can('group_records_all', 'change');
  const SORT_SURNAME = ['surname', 'forenames'];
  const { sorted: sortedMembers, sortKey, sortDir, onSort } = useSortedData(teamMembers, SORT_SURNAME, 'asc');

  useEffect(() => {
    load();
    if (canManage) {
      membersApi.list({}).then(setAllMembers).catch(() => {});
      teamsApi.list({ activeOnly: true }).then(setAllTeams).catch(() => {});
    }
  }, [teamId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await teamsApi.listMembers(teamId);
      setTeamMembers(rows);
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
      await teamsApi.addMember(teamId, { memberId: addByName });
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
      await teamsApi.addMember(teamId, { membershipNumber: num });
      setAddByNumber('');
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(memberId) {
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      await teamsApi.removeMember(teamId, memberId);
      setTeamMembers((prev) => prev.filter((m) => m.member_id !== memberId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleLeader(memberId, currentIsLeader) {
    try {
      const updated = await teamsApi.updateMember(teamId, memberId, { isLeader: !currentIsLeader });
      setTeamMembers((prev) =>
        prev.map((m) => m.member_id === updated.member_id ? { ...m, is_leader: updated.is_leader } : m),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleSelect(memberId) {
    setSelected((prev) => { const n = new Set(prev); n.has(memberId) ? n.delete(memberId) : n.add(memberId); return n; });
  }

  function toggleDlField(key) {
    setDlFields((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  async function handleBulkDo() {
    if (selected.size === 0) return;
    if (bulkAction === 'send_email') {
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([...selected]));
      navigate('/email/compose');
      return;
    }
    if (bulkAction === 'remove_members') {
      if (!window.confirm(`Remove ${selected.size} member${selected.size !== 1 ? 's' : ''} from this team?`)) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await teamsApi.bulkRemoveMembers(teamId, [...selected]);
        setBulkResult({ type: 'success', msg: `${result.removed} member${result.removed !== 1 ? 's' : ''} removed from team.` });
        setSelected(new Set());
        await load();
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
      return;
    }
    if (bulkAction === 'add_to_team') {
      if (!targetTeamId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await teamsApi.bulkAddToTeam(teamId, targetTeamId, [...selected]);
        const targetName = allTeams.find((t) => t.id === targetTeamId)?.name ?? 'team';
        const parts = [];
        if (result.added > 0) parts.push(`${result.added} added`);
        if (result.skipped > 0) parts.push(`${result.skipped} already in team`);
        setBulkResult({ type: 'success', msg: `"${targetName}": ${parts.join(', ')}.` });
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
      return;
    }
  }

  async function handleDownload(format) {
    const ids = [...selected];
    const fields = TEAM_DL_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
    setBulkWorking(true);
    setBulkResult(null);
    try {
      await teamsApi.downloadMembers(teamId, format, ids, fields);
    } catch (err) {
      setBulkResult({ type: 'error', msg: err.message });
    } finally {
      setBulkWorking(false);
    }
  }

  function rowStyle(m) {
    if (m.status === 'Resigned' || m.status === 'Deceased') return 'line-through text-red-500';
    if (m.status === 'Lapsed') return 'text-red-500';
    return '';
  }

  if (loading) return <p className="text-center text-slate-500 py-8">Loading…</p>;

  const memberIdsInTeam = new Set(teamMembers.map((m) => m.member_id));
  const availableToAdd = allMembers.filter((m) => !memberIdsInTeam.has(m.id));
  const cbCls = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Select controls ─────────────────────────────────────────── */}
      {sortedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-slate-500">{sortedMembers.length} member{sortedMembers.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">|</span>
          <span className="font-medium text-slate-600">Select:</span>
          <button onClick={() => setSelected(new Set(sortedMembers.map((m) => m.member_id)))}
            className="text-blue-700 hover:underline">All</button>
          <button onClick={() => setSelected(new Set())} className="text-blue-700 hover:underline">Clear</button>
          <button onClick={() => setSelected(new Set(sortedMembers.filter((m) => m.email).map((m) => m.member_id)))}
            className="text-blue-700 hover:underline">Email only</button>
          <button onClick={() => setSelected(new Set(sortedMembers.filter((m) => !m.email).map((m) => m.member_id)))}
            className="text-blue-700 hover:underline">Without email</button>
          {selected.size > 0 && <span className="font-medium text-blue-700">{selected.size} selected</span>}
        </div>
      )}

      {/* ── Members table ──────────────────────────────────────────── */}
      {sortedMembers.length === 0 ? (
        <p className="text-slate-500 text-sm">No members to display.</p>
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-lg shadow-sm">
          <table className="w-full text-sm bg-white min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                <th className="px-2 py-2"></th>
                <SortableHeader col="membership_number" label="No" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <th className="px-3 py-2 font-normal">
                  <span className="cursor-pointer select-none" onClick={() => onSort('forenames')}>
                    Name
                    <span className={`ml-1 text-xs ${sortKey === 'forenames' ? 'text-blue-600' : 'text-slate-300'}`}>
                      {sortKey === 'forenames' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                  <span className="text-slate-300 mx-1">|</span>
                  <span className="cursor-pointer select-none text-xs not-italic" onClick={() => onSort(SORT_SURNAME)}>
                    by surname
                    <span className={`ml-1 text-xs ${Array.isArray(sortKey) && sortKey[0] === 'surname' ? 'text-blue-600' : 'text-slate-300'}`}>
                      {Array.isArray(sortKey) && sortKey[0] === 'surname' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                </th>
                <SortableHeader col="house_no"   label="Address"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="telephone"  label="Telephone" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="mobile"     label="Mobile"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="status"     label="Status"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="is_leader"  label="Leader"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m, i) => (
                <tr key={m.member_id} className={`border-b border-slate-100 ${selected.has(m.member_id) ? 'outline outline-2 outline-blue-400' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={selected.has(m.member_id)} onChange={() => toggleSelect(m.member_id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    {!m.email && <NoEmailIcon className="ml-1" />}
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${isSubscriptionOverdue(m) ? 'text-red-600' : ''}`}>
                    {can('member_record', 'view') ? (
                      <a href="#view" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.member_id}`); }}
                        className={`hover:underline ${isSubscriptionOverdue(m) ? 'text-red-600' : 'text-blue-700'}`}>
                        {m.membership_number}
                      </a>
                    ) : m.membership_number}
                  </td>
                  <td className={`px-3 py-2 font-medium ${rowStyle(m)} ${isSubscriptionOverdue(m) ? 'text-red-600' : ''}`}>
                    {m.is_leader && <span className="text-blue-600 font-medium mr-1">★</span>}
                    {can('member_record', 'view') ? (
                      <a href="#view" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.member_id}`); }}
                        className={`hover:underline ${isSubscriptionOverdue(m) ? 'text-red-600' : 'text-blue-700'}`}>
                        {formatMemberName(m)}
                      </a>
                    ) : formatMemberName(m)}
                  </td>
                  <td className="px-3 py-2">{formatShortAddress(m)}</td>
                  <td className="px-3 py-2">{m.telephone ?? ''}</td>
                  <td className="px-3 py-2">{m.mobile ?? ''}</td>
                  <td className="px-3 py-2">{m.status ?? ''}</td>
                  <td className="px-3 py-2">{m.is_leader ? 'Yes' : ''}</td>
                  {canManage && (
                    <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                      <button onClick={() => handleToggleLeader(m.member_id, m.is_leader)}
                        className="text-blue-600 hover:underline text-xs">
                        {m.is_leader ? 'Remove leader' : 'Make leader'}
                      </button>
                      <button onClick={() => handleRemove(m.member_id)}
                        className="text-red-600 hover:underline text-xs">
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

      {/* ── Bulk actions ───────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor="team-bulk-action" className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}</label>
              <select id="team-bulk-action" name="bulkAction" value={bulkAction}
                onChange={(e) => { setBulkAction(e.target.value); setBulkResult(null); setTargetTeamId(''); }}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— choose action —</option>
                {can('email', 'send') && <option value="send_email">Send email</option>}
                <option value="download_excel">Download Excel</option>
                <option value="download_pdf">Download PDF</option>
                {canManage && <option value="remove_members">Remove members</option>}
                {canManage && <option value="add_to_team">Add to another team</option>}
              </select>
            </div>

            {bulkAction === 'add_to_team' && (
              <div>
                <label htmlFor="team-target-team" className="block text-sm font-medium text-slate-700 mb-1">Target team</label>
                <select id="team-target-team" name="targetTeamId" value={targetTeamId}
                  onChange={(e) => setTargetTeamId(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— select team —</option>
                  {allTeams.filter((t) => t.id !== teamId).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(bulkAction === 'send_email' || bulkAction === 'remove_members' || bulkAction === 'add_to_team') && (
              <button onClick={handleBulkDo}
                disabled={bulkWorking || (bulkAction === 'add_to_team' && !targetTeamId)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                {bulkWorking ? 'Working…' : 'Do with selected'}
              </button>
            )}

            {bulkResult && (
              <p className={`text-sm font-medium ${bulkResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                {bulkResult.msg}
              </p>
            )}
          </div>

          {(bulkAction === 'download_excel' || bulkAction === 'download_pdf') && (
            <div className="border border-slate-200 rounded p-3 bg-slate-50">
              <p className="text-sm font-medium text-slate-700 mb-2">Fields to include:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mb-3">
                {TEAM_DL_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={dlFields.has(f.key)} onChange={() => toggleDlField(f.key)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    {f.label}
                  </label>
                ))}
              </div>
              <button onClick={() => handleDownload(bulkAction === 'download_excel' ? 'excel' : 'pdf')}
                disabled={bulkWorking || dlFields.size === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                {bulkWorking ? 'Downloading…' : `Download ${bulkAction === 'download_excel' ? 'Excel' : 'PDF'}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Add members ───────────────────────────────────────────── */}
      {canManage && (
        <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Add a member</h3>
          {addError && <p className="text-red-600 text-sm">{addError}</p>}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="team-add-by-name" className="block text-sm font-medium text-slate-700 mb-1">Add member by name</label>
              <select id="team-add-by-name" name="addByName" value={addByName}
                onChange={(e) => setAddByName(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— select member —</option>
                {availableToAdd.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.surname}, {m.forenames}{m.known_as ? ` (${m.known_as})` : ''} — #{m.membership_number}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleAddByName} disabled={!addByName || addLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium">
              Add
            </button>
          </div>

          <div className="flex gap-2 items-end">
            <div>
              <label htmlFor="team-add-by-number" className="block text-sm font-medium text-slate-700 mb-1">Add member by membership number</label>
              <input id="team-add-by-number" type="number" min="1" name="addByNumber" value={addByNumber}
                onChange={(e) => setAddByNumber(e.target.value)} placeholder="e.g. 42"
                className="border border-slate-300 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleAddByNumber} disabled={!addByNumber || addLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium">
              Add
            </button>
          </div>
        </div>
      )}

      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}

// ─── Ledger sub-component ─────────────────────────────────────────────────

function TeamLedger({ teamId }) {
  const { can } = useAuth();

  const thisYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${thisYear}-01-01`);
  const [toDate,   setToDate]   = useState(`${thisYear}-12-31`);

  const [broughtForward, setBroughtForward] = useState(0);
  const [entries,        setEntries]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const EMPTY_ENTRY = { entryDate: '', payee: '', detail: '', moneyIn: '', moneyOut: '' };
  const [addForm,    setAddForm]    = useState(EMPTY_ENTRY);
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState(null);

  const [editId,     setEditId]     = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState(null);

  const canChange   = can('group_ledger_all', 'change')   || can('group_ledger_as_leader', 'change');
  const canCreate   = can('group_ledger_all', 'create')   || can('group_ledger_as_leader', 'create');
  const canDelete   = can('group_ledger_all', 'delete')   || can('group_ledger_as_leader', 'delete');
  const canDownload = can('group_ledger_all', 'download') || can('group_ledger_as_leader', 'download');

  useEffect(() => { load(); }, [teamId, fromDate, toDate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await teamsApi.getLedger(teamId, { from: fromDate, to: toDate });
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
      await teamsApi.updateLedgerEntry(teamId, entryId, {
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
      await teamsApi.deleteLedgerEntry(teamId, entryId);
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
      await teamsApi.createLedgerEntry(teamId, {
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
      await requestBlob(`/teams/${teamId}/ledger/download?${qs}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-0.5';

  const rows = computeRows();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Team Ledger</h2>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium mb-3">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label htmlFor="tledger-from-date" className={labelCls}>From</label>
          <input id="tledger-from-date" name="fromDate" type="date" className={inputCls} value={fromDate}
            onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tledger-to-date" className={labelCls}>To</label>
          <input id="tledger-to-date" name="toDate" type="date" className={inputCls} value={toDate}
            onChange={(e) => setToDate(e.target.value)} />
        </div>
        {canDownload && (
          <button onClick={handleDownload}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm">
            Download Excel
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
                {(canChange || canDelete) && <th className="px-3 py-2 border-b border-slate-200"></th>}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-yellow-50">
                <td className="px-3 py-1.5 border-b border-slate-100 font-medium text-slate-600" colSpan={3}>Brought Forward</td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right"></td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right"></td>
                <td className="px-3 py-1.5 border-b border-slate-100 text-right font-medium">{broughtForward.toFixed(2)}</td>
                {(canChange || canDelete) && <td className="px-3 py-1.5 border-b border-slate-100"></td>}
              </tr>

              {rows.length === 0 && (
                <tr>
                  <td colSpan={canChange || canDelete ? 7 : 6} className="px-3 py-4 text-center text-slate-400 text-sm">
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
                          <label htmlFor="tledger-edit-date" className={labelCls}>Date</label>
                          <input id="tledger-edit-date" name="entryDate" type="date" className={inputCls} value={editForm.entryDate}
                            onChange={(e) => setEditForm((p) => ({ ...p, entryDate: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-32">
                          <label htmlFor="tledger-edit-payee" className={labelCls}>Payee</label>
                          <input id="tledger-edit-payee" name="payee" className={`${inputCls} w-full`} value={editForm.payee}
                            onChange={(e) => setEditForm((p) => ({ ...p, payee: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-40">
                          <label htmlFor="tledger-edit-detail" className={labelCls}>Detail</label>
                          <input id="tledger-edit-detail" name="detail" className={`${inputCls} w-full`} value={editForm.detail}
                            onChange={(e) => setEditForm((p) => ({ ...p, detail: e.target.value }))} />
                        </div>
                        <div className="w-24">
                          <label htmlFor="tledger-edit-in" className={labelCls}>In (£)</label>
                          <input id="tledger-edit-in" name="moneyIn" type="number" min="0" step="0.01" className={inputCls}
                            value={editForm.moneyIn}
                            onChange={(e) => setEditForm((p) => ({ ...p, moneyIn: e.target.value, moneyOut: '' }))} />
                        </div>
                        <div className="w-24">
                          <label htmlFor="tledger-edit-out" className={labelCls}>Out (£)</label>
                          <input id="tledger-edit-out" name="moneyOut" type="number" min="0" step="0.01" className={inputCls}
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
                          <button onClick={() => startEdit(entry)} className="text-blue-600 hover:underline text-sm mr-3">edit</button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(entry.id)} className="text-red-600 hover:underline text-sm">delete</button>
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

      {canCreate && (
        <form onSubmit={handleAdd} className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Transaction</h3>
          {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor="tledger-add-date" className={labelCls}>Date <RequiredMark /></label>
              <input id="tledger-add-date" name="entryDate" type="date" required className={inputCls} value={addForm.entryDate}
                onChange={(e) => setAddForm((p) => ({ ...p, entryDate: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-32">
              <label htmlFor="tledger-add-payee" className={labelCls}>Payee</label>
              <input id="tledger-add-payee" name="payee" className={`${inputCls} w-full`} value={addForm.payee}
                onChange={(e) => setAddForm((p) => ({ ...p, payee: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-40">
              <label htmlFor="tledger-add-detail" className={labelCls}>Detail</label>
              <input id="tledger-add-detail" name="detail" className={`${inputCls} w-full`} value={addForm.detail}
                onChange={(e) => setAddForm((p) => ({ ...p, detail: e.target.value }))} />
            </div>
            <div className="w-24">
              <label htmlFor="tledger-add-in" className={labelCls}>In (£)</label>
              <input id="tledger-add-in" name="moneyIn" type="number" min="0" step="0.01" className={inputCls}
                value={addForm.moneyIn}
                onChange={(e) => setAddForm((p) => ({ ...p, moneyIn: e.target.value, moneyOut: '' }))} />
            </div>
            <div className="w-24">
              <label htmlFor="tledger-add-out" className={labelCls}>Out (£)</label>
              <input id="tledger-add-out" name="moneyOut" type="number" min="0" step="0.01" className={inputCls}
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

// ─── TeamRecord page ─────────────────────────────────────────────────────

export default function TeamRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, tenant } = useAuth();
  const [teamName, setTeamName] = useState('');

  const isNew = id === undefined;
  const activeTab = searchParams.get('tab') ?? 'details';

  useEffect(() => {
    if (!isNew) {
      teamsApi.get(id)
        .then((t) => setTeamName(t.name))
        .catch(() => {});
    }
  }, [id]);

  function handleSaved(result) {
    if (isNew) {
      navigate(`/teams/${result.id}`);
    } else {
      setTeamName(result.name ?? teamName);
    }
  }

  function handleDeleted() {
    navigate('/teams');
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Teams', to: '/teams' },
    ...(can('group_records_all', 'create') ? [{ label: 'Add New Team', to: '/teams/new' }] : []),
  ];

  const tabs = [
    { key: 'details', label: 'Details',  available: true },
    { key: 'members', label: 'Members',  available: !isNew },
    { key: 'ledger',  label: 'Ledger',   available: !isNew && (can('group_ledger_all', 'view') || can('group_ledger_as_leader', 'view')) },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Title */}
        <h1 className="text-xl font-bold text-center mb-3">
          {isNew ? 'Add New Team' : (teamName || 'Team Record')}
        </h1>

        {/* Tab navigation (only when editing existing) */}
        {!isNew && (
          <div role="tablist" className="flex gap-0 mb-4 border-b border-slate-300">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
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
            <TeamDetails
              teamId={isNew ? null : id}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          )}
          {!isNew && activeTab === 'members' && (
            <TeamMembers teamId={id} />
          )}
          {!isNew && activeTab === 'ledger' && (
            <TeamLedger teamId={id} />
          )}
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
