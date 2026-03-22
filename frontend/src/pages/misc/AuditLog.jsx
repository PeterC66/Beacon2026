// beacon2/frontend/src/pages/misc/AuditLog.jsx
// Audit log viewer — doc 9.2(a)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { audit as auditApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { ENTITY_ROUTES } from './auditHelpers.js';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function iso3MonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

const ACTION_LABELS = {
  create: { label: 'Created',   cls: 'bg-green-100 text-green-800' },
  update: { label: 'Updated',   cls: 'bg-blue-100 text-blue-800'  },
  delete: { label: 'Deleted',   cls: 'bg-red-100 text-red-800'    },
  clear:  { label: 'Cleared',   cls: 'bg-amber-100 text-amber-800'},
};

export default function AuditLog() {
  const navigate = useNavigate();
  const { can, tenant } = useAuth();
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [fromDate,   setFromDate]   = useState(iso3MonthsAgo());
  const [toDate,     setToDate]     = useState(isoToday());
  const [filterErr,  setFilterErr]  = useState(null);

  // Delete-before form
  const [deleteDate, setDeleteDate] = useState('');
  const [deleting,   setDeleting]   = useState(false);
  const [deleteMsg,  setDeleteMsg]  = useState(null);

  const tableRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setFilterErr(null);
    try {
      const data = await auditApi.list({ from: fromDate, to: toDate });
      setEntries(data);
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

  async function handleDelete(e) {
    e.preventDefault();
    if (!deleteDate) return;
    if (!confirm(`Delete all audit entries before ${deleteDate}?`)) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await auditApi.deleteBefore(deleteDate);
      setDeleteMsg({ type: 'success', text: `${res.deleted} entr${res.deleted === 1 ? 'y' : 'ies'} deleted.` });
      load();
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message });
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const navLinks = [{ label: 'Home', to: '/' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Audit Log</h1>

        {/* ── Date range filter ───────────────────────────────────── */}
        <form onSubmit={handleApply} className="bg-white/90 rounded-lg shadow-sm p-3 mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
            <DateInput value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <DateInput value={toDate} onChange={setToDate} />
          </div>
          <button type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium transition-colors">
            Apply Filter
          </button>
          {filterErr && <p className="text-sm text-red-600 self-center">{filterErr}</p>}
        </form>

        {/* ── Results ────────────────────────────────────────────── */}
        {error   && <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm text-center mb-4">{error}</p>}
        {loading && <p className="text-center text-slate-500 py-6">Loading…</p>}

        {!loading && !error && (
          <>
            <p className="text-sm text-slate-500 mb-2">
              {entries.length === 500 ? '500+ entries (showing first 500)' : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
            </p>
            {entries.length === 0 ? (
              <p className="text-center text-slate-400 italic py-6">No audit entries in this date range.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-sm mb-6" ref={tableRef}>
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className="px-3 py-2.5 font-normal whitespace-nowrap">When</th>
                      <th className="px-3 py-2.5 font-normal">By</th>
                      <th className="px-3 py-2.5 font-normal">Action</th>
                      <th className="px-3 py-2.5 font-normal">Target</th>
                      <th className="px-3 py-2.5 font-normal">Key</th>
                      <th className="px-3 py-2.5 font-normal">Record</th>
                      <th className="px-3 py-2.5 font-normal">Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => {
                      const act = ACTION_LABELS[e.action] ?? { label: e.action, cls: 'bg-slate-100 text-slate-700' };
                      const entityRoute = ENTITY_ROUTES[e.entity_type];
                      const canView = entityRoute && e.entity_id;
                      return (
                        <tr key={e.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums text-xs">
                            <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`/audit/${e.id}`)}>
                              {formatDate(e.created_at)}
                            </button>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{e.user_name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${act.cls}`}>{act.label}</span>
                          </td>
                          <td className="px-3 py-2">{e.entity_name ?? ''}</td>
                          <td className="px-3 py-2 text-slate-600">{e.entity_id ?? ''}</td>
                          <td className="px-3 py-2">
                            {canView && (
                              <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`${entityRoute}/${e.entity_id}`)}>
                                view
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 capitalize text-slate-600">{e.entity_type}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Delete before date ─────────────────────────────── */}
            {can('audit_trail', 'delete') && (
              <div className="bg-white/90 rounded-lg shadow-sm p-4 border border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Remove old entries</h2>
                <form onSubmit={handleDelete} className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Delete all entries before</label>
                    <DateInput value={deleteDate} onChange={setDeleteDate} />
                  </div>
                  <button type="submit" disabled={!deleteDate || deleting}
                    className="border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded px-4 py-2 text-sm transition-colors">
                    {deleting ? 'Deleting…' : 'Delete entries'}
                  </button>
                  {deleteMsg && (
                    <p className={`text-sm self-center ${deleteMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                      {deleteMsg.text}
                    </p>
                  )}
                </form>
              </div>
            )}
          </>
        )}
      </div>

      <NavBar links={navLinks} />
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
