// beacon2/frontend/src/pages/misc/GiftAidLog.jsx
// Gift Aid log viewer — doc 9.2(b)
// Shows when Gift Aid consent was given or withdrawn, with date range and member filters.

import { useState, useEffect } from 'react';
import { giftAid as giftAidApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function iso3MonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

const ACTION_LABELS = {
  gift_aid_consent:   { label: 'Consent given',   cls: 'bg-green-100 text-green-800' },
  gift_aid_withdrawn: { label: 'Consent withdrawn', cls: 'bg-red-100 text-red-800' },
};

export default function GiftAidLog() {
  const { tenant } = useAuth();
  const [entries,    setEntries]    = useState([]);
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [fromDate,   setFromDate]   = useState(iso3MonthsAgo());
  const [toDate,     setToDate]     = useState(isoToday());
  const [memberId,   setMemberId]   = useState('');
  const [filterErr,  setFilterErr]  = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setFilterErr(null);
    try {
      const data = await giftAidApi.log({ from: fromDate, to: toDate, memberId: memberId || undefined });
      setEntries(data.rows);
      setMembers(data.members);
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

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function parseDetail(detail) {
    if (!detail) return {};
    try { return JSON.parse(detail); } catch { return {}; }
  }

  function formatGaDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-GB');
    } catch { return ''; }
  }

  const navLinks = [{ label: 'Home', to: '/' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Gift Aid Log</h1>

        {/* ── Filters ────────────────────────────────────────────── */}
        <form onSubmit={handleApply} className="bg-white/90 rounded-lg shadow-sm p-3 mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
            <DateInput value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <DateInput value={toDate} onChange={setToDate} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Member</label>
            <select name="memberId" value={memberId} onChange={(e) => setMemberId(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— all members —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
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
              <p className="text-center text-slate-400 italic py-6">No Gift Aid consent changes in this date range.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-sm">
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className="px-3 py-2.5 font-normal whitespace-nowrap">When</th>
                      <th className="px-3 py-2.5 font-normal">By</th>
                      <th className="px-3 py-2.5 font-normal">Member</th>
                      <th className="px-3 py-2.5 font-normal">Action</th>
                      <th className="px-3 py-2.5 font-normal">Gift Aid from</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => {
                      const act = ACTION_LABELS[e.action] ?? { label: e.action, cls: 'bg-slate-100 text-slate-700' };
                      const detail = parseDetail(e.detail);
                      const gaDate = detail.giftAidFrom
                        ? formatGaDate(detail.giftAidFrom)
                        : (detail.previousGiftAidFrom ? formatGaDate(detail.previousGiftAidFrom) : '');
                      return (
                        <tr key={e.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums text-xs">{formatDate(e.created_at)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{e.user_name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{e.entity_name ?? ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${act.cls}`}>{act.label}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">{gaDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
