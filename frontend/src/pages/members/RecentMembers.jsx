// beacon2/frontend/src/pages/members/RecentMembers.jsx
// Doc 4.4 — Recent Members

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { members as membersApi, groups as groupsApi, polls as pollsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import DateInput from '../../components/DateInput.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { formatShortAddress, formatPhone } from '../../lib/memberFormatters.js';
import { formatMemberName } from '../../hooks/usePreferences.js';
import NoEmailIcon from '../../components/NoEmailIcon.jsx';

const DOWNLOAD_FIELDS = [
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
  { key: 'county',            label: 'County',        default: false },
  { key: 'postcode',          label: 'Postcode',      default: true },
  { key: 'status',            label: 'Status',        default: true },
  { key: 'class',             label: 'Class',         default: true },
  { key: 'joined_on',         label: 'Joined',        default: true },
];

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
  const navigate = useNavigate();
  const [list,       setList]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [fromDate,   setFromDate]   = useState(iso30DaysAgo());
  const [toDate,     setToDate]     = useState(isoToday());
  const [filterErr,  setFilterErr]  = useState(null);
  const [selected,   setSelected]   = useState(new Set());

  // Bulk actions
  const [bulkAction,  setBulkAction]  = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkResult,  setBulkResult]  = useState(null);

  // Download field picker
  const [dlFields,    setDlFields]    = useState(new Set(DOWNLOAD_FIELDS.filter((f) => f.default).map((f) => f.key)));

  // For "Add to poll"
  const [polls,       setPolls]       = useState([]);
  const [addToPollId, setAddToPollId] = useState('');

  // For "Add to group"
  const [allGroups,   setAllGroups]   = useState([]);
  const [addToGroupId, setAddToGroupId] = useState('');

  const SORT_SURNAME = ['surname', 'forenames'];
  const { sorted, sortKey, sortDir, onSort } = useSortedData(list, 'joined_on', 'desc');

  useEffect(() => {
    load();
    pollsApi.list().then(setPolls).catch(() => {});
    groupsApi.list({ activeOnly: true }).then(setAllGroups).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setFilterErr(null);
    setSelected(new Set());
    setBulkResult(null);
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

  function selectAll()               { setSelected(new Set(sorted.map((m) => m.id))); }
  function clearAll()                { setSelected(new Set()); }
  function selectEmail()             { setSelected(new Set(sorted.filter((m) => m.email).map((m) => m.id))); }
  function selectNoEmail()           { setSelected(new Set(sorted.filter((m) => !m.email).map((m) => m.id))); }
  function selectPortalPassword()    { setSelected(new Set(sorted.filter((m) => m.has_portal_password).map((m) => m.id))); }
  function selectNoPortalPassword()  { setSelected(new Set(sorted.filter((m) => !m.has_portal_password).map((m) => m.id))); }
  function selectEmailNotConfirmed() { setSelected(new Set(sorted.filter((m) => m.has_portal_password && !m.portal_email_verified).map((m) => m.id))); }
  function toggleAll(checked) {
    if (checked) setSelected(new Set(sorted.map((m) => m.id)));
    else         setSelected(new Set());
  }

  function toggleOne(id, checked) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
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
    if (bulkAction === 'send_letter') {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([...selected]));
      navigate('/letters/compose');
      return;
    }
    if (bulkAction === 'download_names') {
      const names = list
        .filter((m) => selected.has(m.id))
        .map((m) => `${m.forenames} ${m.surname}`)
        .join(', ');
      const blob = new Blob([names], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const tenantPart = (tenant || '').replace(/^u3a_/, '');
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `${tenantPart}_recent_members_${stamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (bulkAction === 'add_to_poll') {
      if (!addToPollId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await pollsApi.addMembers(addToPollId, [...selected]);
        const pollName = polls.find((p) => p.id === addToPollId)?.name ?? 'poll';
        setBulkResult({ type: 'success', msg: `${result.added} member${result.added !== 1 ? 's' : ''} added to "${pollName}".` });
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
      return;
    }
    if (bulkAction === 'add_to_group') {
      if (!addToGroupId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await groupsApi.bulkAddMembers(addToGroupId, [...selected]);
        const groupName = allGroups.find((g) => g.id === addToGroupId)?.name ?? 'group';
        const parts = [];
        if (result.added)      parts.push(`${result.added} added`);
        if (result.waitlisted) parts.push(`${result.waitlisted} waitlisted`);
        if (result.skipped)    parts.push(`${result.skipped} already in group`);
        setBulkResult({ type: 'success', msg: `"${groupName}": ${parts.join(', ')}.` });
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
    const fields = DOWNLOAD_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
    setBulkWorking(true);
    setBulkResult(null);
    try {
      await membersApi.download(format, ids, fields);
    } catch (err) {
      setBulkResult({ type: 'error', msg: err.message });
    } finally {
      setBulkWorking(false);
    }
  }

  const allChecked = sorted.length > 0 && sorted.every((m) => selected.has(m.id));
  const hasBulkPolls  = can('poll_set_up', 'change') && polls.length > 0;
  const hasBulkGroups = can('groups_list', 'view') && allGroups.length > 0;
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
            <DateInput name="fromDate" value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <DateInput name="toDate" value={toDate} onChange={setToDate} />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
            Apply
          </button>
          {filterErr && <p className="text-sm text-red-600">{filterErr}</p>}
        </form>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : (
          <>
            {/* Select controls — above the table */}
            {sorted.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="text-sm text-slate-500">
                  {sorted.length} member{sorted.length !== 1 ? 's' : ''} joined between {fmtDate(fromDate)} and {fmtDate(toDate)}.
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-medium text-slate-600">Select:</span>
                <button onClick={selectAll} className="text-sm text-blue-700 hover:underline">All</button>
                <button onClick={clearAll} className="text-sm text-blue-700 hover:underline">Clear All</button>
                <button onClick={selectEmail} className="text-sm text-blue-700 hover:underline">Email only</button>
                <button onClick={selectNoEmail} className="text-sm text-blue-700 hover:underline">Without email</button>
                <button onClick={selectPortalPassword} className="text-sm text-blue-700 hover:underline">Portal password set</button>
                <button onClick={selectNoPortalPassword} className="text-sm text-blue-700 hover:underline">Without portal password</button>
                <button onClick={selectEmailNotConfirmed} className="text-sm text-blue-700 hover:underline">Email not confirmed</button>
                {selected.size > 0 && (
                  <span className="text-sm font-medium text-blue-700 ml-2">{selected.size} selected</span>
                )}
              </div>
            )}
            {sorted.length === 0 && (
              <p className="text-sm text-slate-600">
                {sorted.length} member{sorted.length !== 1 ? 's' : ''} joined between {fmtDate(fromDate)} and {fmtDate(toDate)}.
              </p>
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
                    <th className={TH}>
                      <span className="cursor-pointer select-none" onClick={() => onSort('forenames')}>
                        Name
                        <span className={`ml-1 text-xs ${sortKey === 'forenames' ? 'text-blue-600' : 'text-slate-300'}`}>
                          {sortKey === 'forenames' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                      <span className="text-slate-300 mx-1">|</span>
                      <span className="cursor-pointer select-none text-xs" onClick={() => onSort(SORT_SURNAME)}>
                        by surname
                        <span className={`ml-1 text-xs ${Array.isArray(sortKey) && sortKey[0] === 'surname' ? 'text-blue-600' : 'text-slate-300'}`}>
                          {Array.isArray(sortKey) && sortKey[0] === 'surname' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      </span>
                    </th>
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
                        {!m.email && <NoEmailIcon className="ml-1" />}
                      </td>
                      <td className="px-4 py-2">
                        <Link to={`/members/${m.id}`} className="text-blue-600 hover:underline">
                          {m.membership_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <Link to={`/members/${m.id}`} className="text-blue-600 hover:underline">
                          {formatMemberName(m)}
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

            {/* Bulk actions — below the table */}
            {selected.size > 0 && (
              <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}</label>
                    <select
                      name="bulkAction"
                      value={bulkAction}
                      onChange={(e) => { setBulkAction(e.target.value); setBulkResult(null); }}
                      className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— choose action —</option>
                      <option value="download_names">Download names as txt file</option>
                      {can('email', 'send') && <option value="send_email">Send E-mail</option>}
                      {can('letters', 'view') && <option value="send_letter">Send Letter</option>}
                      {hasBulkPolls && <option value="add_to_poll">Add to poll</option>}
                      {hasBulkGroups && <option value="add_to_group">Add to group</option>}
                      <option value="download_excel">Download Excel</option>
                      <option value="download_pdf">Download PDF</option>
                    </select>
                  </div>

                  {bulkAction === 'add_to_poll' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
                      <select
                        name="addToPollId"
                        value={addToPollId}
                        onChange={(e) => setAddToPollId(e.target.value)}
                        className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— select poll —</option>
                        {polls.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  {bulkAction === 'add_to_group' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
                      <select
                        name="addToGroupId"
                        value={addToGroupId}
                        onChange={(e) => setAddToGroupId(e.target.value)}
                        className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— select group —</option>
                        {allGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}

                  {(bulkAction === 'send_email' || bulkAction === 'send_letter' || bulkAction === 'download_names' || bulkAction === 'add_to_poll' || bulkAction === 'add_to_group') && (
                    <button
                      onClick={handleBulkDo}
                      disabled={bulkWorking || (bulkAction === 'add_to_poll' && !addToPollId) || (bulkAction === 'add_to_group' && !addToGroupId)}
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
                      {DOWNLOAD_FIELDS.map((f) => (
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
          </>
        )}
      </div>
    </div>
  );
}
