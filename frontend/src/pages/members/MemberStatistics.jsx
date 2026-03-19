// beacon2/frontend/src/pages/members/MemberStatistics.jsx
// Doc 4.9 — Membership Statistics

import { useState, useEffect } from 'react';
import { members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import DateInput from '../../components/DateInput.jsx';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}
function pct(n, total) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthName(n) { return MONTHS[(n ?? 1) - 1] ?? ''; }

export default function MemberStatistics() {
  const { tenant } = useAuth();
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState(isoToday());
  const [filterErr, setFilterErr] = useState(null);
  const [applying,  setApplying]  = useState(false);

  useEffect(() => { load(); }, []);

  async function load(from, to) {
    setLoading(true);
    setError(null);
    setFilterErr(null);
    try {
      const data = await membersApi.statistics({ from, to });
      // Use server-returned year start as default from date if not overridden
      if (!from) setFromDate(data.renewFrom ?? data.yearStart);
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setApplying(false);
    }
  }

  function handleApply(e) {
    e.preventDefault();
    if (!fromDate || !toDate) { setFilterErr('Both dates are required.'); return; }
    if (fromDate > toDate)    { setFilterErr('"From" must be before "To".'); return; }
    setApplying(true);
    load(fromDate, toDate);
  }

  function handlePrint() { window.print(); }

  const TH = 'px-4 py-2 font-medium text-left text-slate-600';
  const TD = 'px-4 py-2';
  const SH = 'text-lg font-semibold text-slate-800 mb-3';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Statistics' }]} />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Membership Statistics</h1>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : stats && (
          <>
            {/* Section 1: General Member Status */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className={SH}>1. General Member Status</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">Membership year start</dt>
                  <dd className="font-medium text-slate-800">{fmtDate(stats.yearStart)}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">Advance renewals period</dt>
                  <dd className="font-medium text-slate-800">{stats.advanceRenewalsWeeks} week{stats.advanceRenewalsWeeks !== 1 ? 's' : ''}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">Grace lapse period</dt>
                  <dd className="font-medium text-slate-800">{stats.graceLapseWeeks} week{stats.graceLapseWeeks !== 1 ? 's' : ''}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-600">Current members not yet renewed</dt>
                  <dd className="font-medium text-slate-800">{stats.currentNotRenewed}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-600">Lapsed members (previous year)</dt>
                  <dd className="font-medium text-slate-800">{stats.lapsedCount}</dd>
                </div>
              </dl>
            </section>

            {/* Section 2: Current Members by Class */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className={SH}>2. Current Members by Class</h2>
              <div className="overflow-x-auto">
                <table className="min-w-max w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className={TH}>Class</th>
                      <th className={TH + ' text-right'}>Members</th>
                      <th className={TH + ' text-right'}>%</th>
                      <th className={TH + ' text-right'}>With email</th>
                      <th className={TH + ' text-right'}>First year</th>
                      <th className={TH + ' text-right'}>Second year+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.classStats.map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                        <td className={TD}>{row.name}</td>
                        <td className={TD + ' text-right'}>{row.total}</td>
                        <td className={TD + ' text-right'}>{pct(row.total, stats.totalCurrent)}</td>
                        <td className={TD + ' text-right'}>{row.with_email}</td>
                        <td className={TD + ' text-right'}>{row.first_year}</td>
                        <td className={TD + ' text-right'}>{row.second_year_plus}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold">
                      <td className={TD}>Total</td>
                      <td className={TD + ' text-right'}>{stats.totalCurrent}</td>
                      <td className={TD + ' text-right'}>100%</td>
                      <td className={TD + ' text-right'}>{stats.classStats.reduce((s, r) => s + r.with_email, 0)}</td>
                      <td className={TD + ' text-right'}>{stats.classStats.reduce((s, r) => s + r.first_year, 0)}</td>
                      <td className={TD + ' text-right'}>{stats.classStats.reduce((s, r) => s + r.second_year_plus, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3: Active Groups */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className={SH}>3. Active Groups</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex flex-col items-center bg-slate-50 rounded-lg p-4">
                  <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Active groups</dt>
                  <dd className="text-3xl font-bold text-slate-800">{stats.activeGroups}</dd>
                </div>
                <div className="flex flex-col items-center bg-slate-50 rounded-lg p-4">
                  <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Avg. members per group</dt>
                  <dd className="text-3xl font-bold text-slate-800">{Number(stats.avgGroupMembers).toFixed(1)}</dd>
                </div>
                <div className="flex flex-col items-center bg-slate-50 rounded-lg p-4">
                  <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Current members not in any group</dt>
                  <dd className="text-3xl font-bold text-slate-800">{stats.membersNotInGroup}</dd>
                </div>
              </dl>
            </section>

            {/* Section 4: Members by Renew Date */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <h2 className={SH}>4. Members by Renew Date</h2>
              <form onSubmit={handleApply} className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                  <DateInput value={fromDate} onChange={setFromDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                  <DateInput value={toDate} onChange={setToDate} />
                </div>
                <button
                  type="submit"
                  disabled={applying}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
                >
                  Apply
                </button>
                {filterErr && <p className="text-sm text-red-600">{filterErr}</p>}
              </form>
              <p className="text-xs text-slate-500">
                Showing {fmtDate(stats.renewFrom)} – {fmtDate(stats.renewTo)}.
                "Not renewed" = members whose next renewal date falls in this range who have not renewed.
                "New members" = members who joined in this range.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-max w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className={TH}>Class</th>
                      <th className={TH + ' text-right'}>Not renewed</th>
                      <th className={TH + ' text-right'}>New members joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.renewStats.map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                        <td className={TD}>{row.name}</td>
                        <td className={TD + ' text-right'}>{row.not_renewed}</td>
                        <td className={TD + ' text-right'}>{row.new_members}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold">
                      <td className={TD}>Total</td>
                      <td className={TD + ' text-right'}>{stats.renewStats.reduce((s, r) => s + r.not_renewed, 0)}</td>
                      <td className={TD + ' text-right'}>{stats.renewStats.reduce((s, r) => s + r.new_members, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Download */}
            <div className="flex justify-end">
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
              >
                Download / Print statistics
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
