// beacon2/frontend/src/components/EntityMembers.jsx
// Shared members sub-component used by both GroupRecord and TeamRecord.
// Props:
//   entityId   — the group or team ID
//   api        — the API module (groups or teams), must have listMembers/addMember/updateMember/removeMember/downloadMembers/bulkRemoveMembers/bulkAddToEntity/list
//   entityType — 'group' or 'team' (controls waiting-list support, labels, HTML ids)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { members as membersApi } from '../lib/api.js';
import { useSortedData } from '../hooks/useSortedData.js';
import SortableHeader from './SortableHeader.jsx';
import NoEmailIcon from './NoEmailIcon.jsx';
import ScrollButtons from './ScrollButtons.jsx';
import { formatShortAddress, isSubscriptionOverdue } from '../lib/memberFormatters.js';
import { formatMemberName } from '../hooks/usePreferences.js';

const BASE_DL_FIELDS = [
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

const WAITING_DL_FIELD = { key: 'waiting_since', label: 'Waiting Since', default: false };

export default function EntityMembers({ entityId, api, entityType = 'group' }) {
  const hasWaitingList = entityType === 'group';
  const addToAction = `add_to_${entityType}`;
  const DL_FIELDS = hasWaitingList ? [...BASE_DL_FIELDS, WAITING_DL_FIELD] : BASE_DL_FIELDS;

  const { can } = useAuth();
  const navigate = useNavigate();
  const [entityMembers, setEntityMembers] = useState([]);
  const [allMembers,    setAllMembers]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const tableRef = useRef(null);
  const [addByName,   setAddByName]   = useState('');
  const [addByNumber, setAddByNumber] = useState('');
  const [addError,    setAddError]    = useState(null);
  const [addLoading,  setAddLoading]  = useState(false);

  // Filter checkboxes (groups only — waiting list)
  const [showJoined,  setShowJoined]  = useState(true);
  const [showWaiting, setShowWaiting] = useState(true);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Bulk actions
  const [bulkAction,     setBulkAction]     = useState('');
  const [bulkWorking,    setBulkWorking]    = useState(false);
  const [bulkResult,     setBulkResult]     = useState(null);
  const [dlFields,       setDlFields]       = useState(new Set(DL_FIELDS.filter((f) => f.default).map((f) => f.key)));
  const [allEntities,    setAllEntities]    = useState([]);
  const [targetEntityId, setTargetEntityId] = useState('');

  const canManage = can('group_records_all', 'change');
  const SORT_SURNAME = ['surname', 'forenames'];
  const { sorted: sortedMembers, sortKey, sortDir, onSort } = useSortedData(entityMembers, SORT_SURNAME, 'asc');

  useEffect(() => {
    load();
    if (canManage) {
      membersApi.list({}).then(setAllMembers).catch(() => {});
      api.list({ activeOnly: true }).then(setAllEntities).catch(() => {});
    }
  }, [entityId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listMembers(entityId);
      setEntityMembers(rows);
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
      await api.addMember(entityId, { memberId: addByName });
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
      await api.addMember(entityId, { membershipNumber: num });
      setAddByNumber('');
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(memberId) {
    if (!window.confirm(`Remove this member from the ${entityType}?`)) return;
    try {
      await api.removeMember(entityId, memberId);
      setEntityMembers((prev) => prev.filter((m) => m.member_id !== memberId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleLeader(memberId, currentIsLeader) {
    try {
      const updated = await api.updateMember(entityId, memberId, { isLeader: !currentIsLeader });
      setEntityMembers((prev) =>
        prev.map((m) => m.member_id === updated.member_id ? { ...m, is_leader: updated.is_leader } : m),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoinEntity(memberId) {
    try {
      const updated = await api.updateMember(entityId, memberId, { waitingSince: null });
      setEntityMembers((prev) =>
        prev.map((m) => m.member_id === updated.member_id ? { ...m, waiting_since: null } : m),
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
      if (!window.confirm(`Remove ${selected.size} member${selected.size !== 1 ? 's' : ''} from this ${entityType}?`)) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await api.bulkRemoveMembers(entityId, [...selected]);
        setBulkResult({ type: 'success', msg: `${result.removed} member${result.removed !== 1 ? 's' : ''} removed from ${entityType}.` });
        setSelected(new Set());
        await load();
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
      return;
    }
    if (bulkAction === addToAction) {
      if (!targetEntityId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await api.bulkAddToEntity(entityId, targetEntityId, [...selected]);
        const targetName = allEntities.find((e) => e.id === targetEntityId)?.name ?? entityType;
        const parts = [];
        if (result.added > 0) parts.push(`${result.added} added`);
        if (result.waitlisted > 0) parts.push(`${result.waitlisted} waitlisted`);
        if (result.skipped > 0) parts.push(`${result.skipped} already in ${entityType}`);
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
    const fields = DL_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
    setBulkWorking(true);
    setBulkResult(null);
    try {
      await api.downloadMembers(entityId, format, ids, fields);
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

  // Waiting-list filtering (groups only)
  let visibleMembers = sortedMembers;
  let hasWaiting = false;
  let joinedMembers, waitingMembers;
  if (hasWaitingList) {
    joinedMembers  = sortedMembers.filter((m) => !m.waiting_since);
    waitingMembers = sortedMembers.filter((m) => m.waiting_since);
    hasWaiting = waitingMembers.length > 0;
    visibleMembers = [
      ...(showJoined  ? joinedMembers  : []),
      ...(showWaiting ? waitingMembers : []),
    ];
  }

  const memberIdsInEntity = new Set(entityMembers.map((m) => m.member_id));
  const availableToAdd = allMembers.filter((m) => !memberIdsInEntity.has(m.id));

  const cbCls = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Filter checkboxes (groups with waiting members only) ──── */}
      {hasWaitingList && hasWaiting && (
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

      {/* ── Select controls ─────────────────────────────────────────── */}
      {visibleMembers.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-slate-500">{visibleMembers.length} member{visibleMembers.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">|</span>
          <span className="font-medium text-slate-600">Select:</span>
          <button onClick={() => setSelected(new Set(visibleMembers.map((m) => m.member_id)))}
            className="text-blue-700 hover:underline">All</button>
          <button onClick={() => setSelected(new Set())} className="text-blue-700 hover:underline">Clear</button>
          <button onClick={() => setSelected(new Set(visibleMembers.filter((m) => m.email).map((m) => m.member_id)))}
            className="text-blue-700 hover:underline">Email only</button>
          <button onClick={() => setSelected(new Set(visibleMembers.filter((m) => !m.email).map((m) => m.member_id)))}
            className="text-blue-700 hover:underline">Without email</button>
          {selected.size > 0 && <span className="font-medium text-blue-700">{selected.size} selected</span>}
        </div>
      )}

      {/* ── Members table ─────────────────────────────────────────── */}
      {visibleMembers.length === 0 ? (
        <p className="text-slate-500 text-sm">No members to display.</p>
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-lg shadow-sm">
          <table className="w-full text-sm bg-white min-w-max">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                <th className="px-2 py-2"></th>
                <SortableHeader col="membership_number" label="No"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <th className="px-3 py-2 font-normal">
                  <span className="cursor-pointer select-none" onClick={() => onSort('forenames')}>
                    Name
                    <span className={`ml-1 text-xs ${sortKey === 'forenames' ? 'text-blue-600' : 'text-slate-300'}`}>
                      {sortKey === 'forenames' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                  <span className="text-slate-300 mx-1">|</span>
                  <span
                    className="cursor-pointer select-none text-xs not-italic"
                    onClick={() => onSort(SORT_SURNAME)}
                  >
                    by surname
                    <span className={`ml-1 text-xs ${Array.isArray(sortKey) && sortKey[0] === 'surname' ? 'text-blue-600' : 'text-slate-300'}`}>
                      {Array.isArray(sortKey) && sortKey[0] === 'surname' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </span>
                </th>
                <SortableHeader col="house_no"           label="Address"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="telephone"          label="Telephone"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="mobile"             label="Mobile"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="status"             label="Status"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                <SortableHeader col="is_leader"         label="Leader"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                {hasWaiting && (
                  <SortableHeader col="waiting_since" label="Waiting" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                )}
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m, i) => (
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
                  {hasWaiting && (
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {m.waiting_since ?? ''}
                    </td>
                  )}
                  {canManage && (
                    <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                      {(!hasWaitingList || !m.waiting_since) && (
                        <button
                          onClick={() => handleToggleLeader(m.member_id, m.is_leader)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {m.is_leader ? 'Remove leader' : 'Make leader'}
                        </button>
                      )}
                      {hasWaitingList && m.waiting_since && (
                        <button
                          onClick={() => handleJoinEntity(m.member_id)}
                          className="text-green-700 hover:underline text-xs"
                        >
                          join {entityType}
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

      {/* ── Bulk actions (Do with selected) ─────────────────────── */}
      {selected.size > 0 && (
        <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor={`${entityType}-bulk-action`} className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}</label>
              <select
                id={`${entityType}-bulk-action`}
                name="bulkAction"
                value={bulkAction}
                onChange={(e) => { setBulkAction(e.target.value); setBulkResult(null); setTargetEntityId(''); }}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— choose action —</option>
                {can('email', 'send') && <option value="send_email">Send email</option>}
                <option value="download_excel">Download Excel</option>
                <option value="download_pdf">Download PDF</option>
                {canManage && <option value="remove_members">Remove members</option>}
                {canManage && <option value={addToAction}>Add to another {entityType}</option>}
              </select>
            </div>

            {bulkAction === addToAction && (
              <div>
                <label htmlFor={`${entityType}-target-entity`} className="block text-sm font-medium text-slate-700 mb-1">Target {entityType}</label>
                <select
                  id={`${entityType}-target-entity`}
                  name="targetEntityId"
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— select {entityType} —</option>
                  {allEntities.filter((e) => e.id !== entityId).map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(bulkAction === 'send_email' || bulkAction === 'remove_members' || bulkAction === addToAction) && (
              <button
                onClick={handleBulkDo}
                disabled={bulkWorking || (bulkAction === addToAction && !targetEntityId)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
              >
                {bulkWorking ? 'Working…' : 'Do with selected'}
              </button>
            )}

            {bulkResult && (
              <p className={`text-sm font-medium ${bulkResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                {bulkResult.msg}
              </p>
            )}
          </div>

          {/* Field picker for Excel / PDF downloads */}
          {(bulkAction === 'download_excel' || bulkAction === 'download_pdf') && (
            <div className="border border-slate-200 rounded p-3 bg-slate-50">
              <p className="text-sm font-medium text-slate-700 mb-2">Fields to include:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mb-3">
                {DL_FIELDS.map((f) => (
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

          {/* By name */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor={`${entityType}-add-by-name`} className="block text-sm font-medium text-slate-700 mb-1">Add member by name</label>
              <select
                id={`${entityType}-add-by-name`}
                name="addByName"
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
              <label htmlFor={`${entityType}-add-by-number`} className="block text-sm font-medium text-slate-700 mb-1">Add member by membership number</label>
              <input
                id={`${entityType}-add-by-number`}
                type="number"
                min="1"
                name="addByNumber"
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

      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
