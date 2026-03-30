// beacon2/frontend/src/pages/membership/NonRenewals.jsx
// Doc 4.6 — Non-renewals (Lapsed, Resigned, Deceased members)

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import SortableHeader from '../../components/SortableHeader.jsx';
import NoEmailIcon from '../../components/NoEmailIcon.jsx';
import { formatMemberName } from '../../hooks/usePreferences.js';
import { formatShortAddress } from '../../lib/memberFormatters.js';

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export default function NonRenewals() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [mode,         setMode]         = useState('this_year');
  const [action,       setAction]       = useState('lapse');
  const [data,         setData]         = useState(null);   // { members, yearStart, graceLapse, deletionYears }
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const [selected,     setSelected]     = useState(new Set());
  const [confirming,   setConfirming]   = useState(false);  // 'lapse' | 'delete' | false
  const [processing,   setProcessing]   = useState(false);
  const [result,       setResult]       = useState(null);   // { lapsed?, deleted?, errors? }

  const SORT_SURNAME = ['surname', 'forenames'];
  const { sorted, sortKey, sortDir, onSort } = useSortedData(
    data?.members ?? [],
    SORT_SURNAME,
    'asc',
  );

  useEffect(() => {
    setAction(mode === 'long_term' ? 'delete' : 'lapse');
    load(mode);
  }, [mode]);

  async function load(m) {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setResult(null);
    try {
      const res = await membersApi.listNonRenewals(m);
      setData(res);
    } catch (e) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function toggleAll() {
    if (selected.size === sorted.length && sorted.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((m) => m.id)));
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll()               { setSelected(new Set(sorted.map((m) => m.id))); }
  function clearAll()                { setSelected(new Set()); }
  function selectEmail()             { setSelected(new Set(sorted.filter((m) => m.email).map((m) => m.id))); }
  function selectNoEmail()           { setSelected(new Set(sorted.filter((m) => !m.email).map((m) => m.id))); }
  function selectPortalPassword()    { setSelected(new Set(sorted.filter((m) => m.has_portal_password).map((m) => m.id))); }
  function selectNoPortalPassword()  { setSelected(new Set(sorted.filter((m) => !m.has_portal_password).map((m) => m.id))); }
  function selectEmailNotConfirmed() { setSelected(new Set(sorted.filter((m) => m.has_portal_password && !m.portal_email_verified).map((m) => m.id))); }

  function handleDoWithSelected() {
    if (selected.size === 0) return;
    if (action === 'send_email') {
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([...selected]));
      navigate('/email/compose');
      return;
    }
    if (action === 'send_letter') {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([...selected]));
      navigate('/letters/compose');
      return;
    }
    if (action === 'lapse') {
      setConfirming('lapse');
      return;
    }
    if (action === 'delete') {
      setConfirming('delete');
      return;
    }
  }

  async function handleLapse() {
    if (selected.size === 0) return;
    setProcessing(true);
    setConfirming(false);
    try {
      const res = await membersApi.lapse([...selected]);
      setResult({ lapsed: res.lapsed });
      await load(mode);
    } catch (e) {
      setResult({ errors: [e.message ?? 'Lapse failed'] });
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    setProcessing(true);
    setConfirming(false);
    const ids = [...selected];
    const errors = [];
    let deleted = 0;
    for (const id of ids) {
      try {
        await membersApi.delete(id);
        deleted++;
      } catch (e) {
        errors.push(e.message ?? `Delete failed for member ${id}`);
      }
    }
    setResult({ deleted, errors: errors.length ? errors : undefined });
    await load(mode);
    setProcessing(false);
  }

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const canLapse  = can('members_non_renewals', 'lapse');

  const thCls = 'px-3 py-2.5 text-left font-normal text-slate-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      <PageHeader />
      <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Non-renewals' }]} />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-800">Non-renewals</h1>

        {/* Mode selector */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-medium text-slate-700">Show:</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="this_year"
              checked={mode === 'this_year'}
              onChange={() => setMode('this_year')}
              className="accent-blue-600"
            />
            Members who did not renew this year
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="long_term"
              checked={mode === 'long_term'}
              onChange={() => setMode('long_term')}
              className="accent-blue-600"
            />
            Members who have not renewed for {data?.deletionYears ?? '…'} years
          </label>
        </div>

        {/* Info banners */}
        {data && mode === 'this_year' && (
          <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            Showing Current members with a renewal date before the membership year start
            ({fmtDate(data.yearStart)}).
            Grace period: {data.graceLapse} week{data.graceLapse !== 1 ? 's' : ''}.
          </p>
        )}
        {data && mode === 'long_term' && (
          <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            Showing all members who have not renewed in the last {data.deletionYears} year{data.deletionYears !== 1 ? 's' : ''}.
            Care should be taken not to delete members who have given Gift Aid consent within 7 years.
          </p>
        )}

        {/* Result banner */}
        {result && (
          <div className={`rounded-md border px-4 py-3 text-sm font-medium ${
            result.errors?.length
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            {result.lapsed != null && `✓ ${result.lapsed} member${result.lapsed !== 1 ? 's' : ''} lapsed.`}
            {result.deleted != null && `✓ ${result.deleted} member${result.deleted !== 1 ? 's' : ''} deleted.`}
            {result.errors?.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Loading…</p>}
        {error   && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && data && (
          <>
            {/* Select controls — above the table */}
            {sorted.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="text-sm text-slate-500">{sorted.length} member{sorted.length !== 1 ? 's' : ''}</span>
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

            <div className="bg-white/90 rounded-lg shadow-sm overflow-x-auto">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all"
                        className="accent-blue-600"
                      />
                    </th>
                    <SortableHeader col="membership_number" label="No."      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={thCls} />
                    <th className={thCls}>
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
                    <SortableHeader col="house_no"           label="Address"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={thCls} />
                    <th className={thCls}>Phone</th>
                    <SortableHeader col="class_name"         label="Class"        sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={thCls} />
                    <SortableHeader col="status_name"        label="Status"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={thCls} />
                    <SortableHeader col="next_renewal"       label="Next Renewal" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={thCls} />
                    <SortableHeader col="last_renewal_year"  label="Last Renewal" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={thCls} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                        {mode === 'this_year'
                          ? 'No current members with overdue renewals.'
                          : `No members with renewals older than ${data.deletionYears} years.`}
                      </td>
                    </tr>
                  )}
                  {sorted.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggleOne(m.id)}
                          className="accent-blue-600"
                        />
                        {!m.email && <NoEmailIcon className="ml-1" />}
                      </td>
                      <td className="px-3 py-1.5">
                        <Link to={`/members/${m.id}`} className="text-blue-600 hover:underline">
                          {m.membership_number}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 font-medium">
                        <Link to={`/members/${m.id}`} className="text-blue-600 hover:underline">
                          {formatMemberName(m)}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">{formatShortAddress(m)}</td>
                      <td className="px-3 py-1.5">{m.mobile || m.telephone || ''}</td>
                      <td className="px-3 py-1.5">{m.class_name}</td>
                      <td className="px-3 py-1.5">{m.status_name}</td>
                      <td className="px-3 py-1.5">{fmtDate(m.next_renewal)}</td>
                      <td className="px-3 py-1.5">{m.last_renewal_year ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bulk actions — below the table */}
            {sorted.length > 0 && selected.size > 0 && (
              <div className="bg-white/90 rounded-lg shadow-sm p-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}</label>
                    <select
                      name="action"
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {mode === 'this_year' && canLapse && <option value="lapse">Lapse</option>}
                      {mode === 'long_term' && canLapse && <option value="delete">Delete</option>}
                      {can('email', 'send') && <option value="send_email">Send email</option>}
                      {can('letters', 'view') && <option value="send_letter">Send letter</option>}
                    </select>
                  </div>
                  <button
                    onClick={handleDoWithSelected}
                    disabled={processing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                  >
                    {processing ? 'Processing…' : 'Do with selected'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Guidance notes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-slate-700 space-y-2">
          <p className="font-semibold">Guidance</p>
          <p>
            <strong>Resigned</strong> — use when a member has indicated they will not be continuing.
            Update their Member Record directly.
          </p>
          <p>
            <strong>Lapsed</strong> — use for members who have not renewed by the end of the grace
            period. Lapsed members often renew at a later date, so their record should be kept.
          </p>
          <p>
            <strong>Deceased</strong> — remove the email address from the Member Record to avoid
            emails being sent. If they shared an address, change the 'Share address with' to
            &lt;no-one&gt;.
          </p>
          <p>
            It is important to lapse non-renewals promptly — otherwise the u3a Beacon licence,
            TAT subscription and TAM magazine costs will still be included in invoices.
          </p>
        </div>
      </div>

      {/* Lapse confirmation dialog */}
      {confirming === 'lapse' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Confirm Lapse</h2>
            <p className="text-sm text-slate-600">
              Change the status of <strong>{selected.size}</strong> member
              {selected.size !== 1 ? 's' : ''} from Current to Lapsed?
              This cannot be undone automatically.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleLapse}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded px-4 py-2 text-sm font-medium"
              >
                Lapse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirming === 'delete' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Confirm Delete</h2>
            <p className="text-sm text-slate-600">
              Permanently delete <strong>{selected.size}</strong> member record
              {selected.size !== 1 ? 's' : ''}?
              This action cannot be undone. Ensure members with Gift Aid consent within
              7 years are not deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white rounded px-4 py-2 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
