// beacon2/frontend/src/pages/finance/GroupsStatement.jsx
// Groups statement — summary of group ledgers (doc 7.7).

import { useState } from 'react';
import { finance as financeApi, requestBlob } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';

const thisYear = new Date().getFullYear();
const defaultFrom = `${thisYear}-01-01`;
const defaultTo   = `${thisYear}-12-31`;

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GroupsStatement() {
  const { can, tenant } = useAuth();
  const [from,           setFrom]           = useState(defaultFrom);
  const [to,             setTo]             = useState(defaultTo);
  const [showTxns,       setShowTxns]       = useState(false);
  const [data,           setData]           = useState(null);   // { groups, entries }
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [downloading,    setDownloading]    = useState(false);

  async function handleView(e) {
    e.preventDefault();
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const d = await financeApi.getGroupsStatement({ from, to, showTransactions: showTxns });
      setData(d);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (showTxns) qs.set('showTransactions', '1');
      await requestBlob(`/finance/groups-statement/download?${qs.toString()}`);
    } catch (err) { alert(err.message); }
    finally { setDownloading(false); }
  }

  const canDownload = can('group_statement', 'download');
  const navLinks    = [{ label: 'Home', to: '/' }];

  // Build a lookup of entries by group_id
  const entriesByGroup = {};
  if (data?.entries) {
    for (const e of data.entries) {
      if (!entriesByGroup[e.group_id]) entriesByGroup[e.group_id] = [];
      entriesByGroup[e.group_id].push(e);
    }
  }

  const groups = data?.groups ?? [];
  const totalBf  = groups.reduce((s, g) => s + g.bf,        0);
  const totalIn  = groups.reduce((s, g) => s + g.total_in,  0);
  const totalOut = groups.reduce((s, g) => s + g.total_out, 0);

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-2">Groups Statement</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          Summary of every group's accounts from the Group Ledgers.
          These figures are independent from the main Finance Ledger.
        </p>

        {/* Filter form */}
        <form onSubmit={handleView} className="bg-white/90 rounded-lg shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From date</label>
              <input type="date" name="from" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To date</label>
              <input type="date" name="to" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 mb-3 cursor-pointer">
            <input type="checkbox" checked={showTxns} onChange={(e) => setShowTxns(e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            Show individual transactions
          </label>
          <div className="flex gap-3 flex-wrap">
            <button type="submit" disabled={loading || !from || !to} className={btnPrimary}>
              {loading ? 'Loading…' : 'View'}
            </button>
            {data && canDownload && (
              <button type="button" onClick={handleDownload} disabled={downloading}
                className="border border-blue-300 text-blue-700 hover:bg-blue-50 rounded px-5 py-2 text-sm font-medium transition-colors">
                {downloading ? 'Downloading…' : 'Download Excel'}
              </button>
            )}
          </div>
        </form>

        {error && <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm mb-4">{error}</p>}

        {data && (
          <>
            <p className="text-sm text-slate-500 mb-3">
              Showing {groups.length} group{groups.length !== 1 ? 's' : ''} — {fmtDate(from)} to {fmtDate(to)}
            </p>

            <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 font-normal italic">
                      <th className="px-4 py-2.5 font-normal">Group</th>
                      <th className="px-4 py-2.5 font-normal text-right">B/F</th>
                      <th className="px-4 py-2.5 font-normal text-right">In (£)</th>
                      <th className="px-4 py-2.5 font-normal text-right">Out (£)</th>
                      <th className="px-4 py-2.5 font-normal text-right">Balance (£)</th>
                      <th className="px-4 py-2.5 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-4 text-center text-slate-400">No groups found.</td></tr>
                    )}
                    {groups.map((g, i) => (
                      <>
                        <tr key={g.id}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} ${showTxns && entriesByGroup[g.id] ? 'font-semibold' : ''}`}>
                          <td className="px-4 py-2">{g.name}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-700">{g.bf !== 0 ? fmtAmt(g.bf) : ''}</td>
                          <td className="px-4 py-2 text-right font-mono text-green-700">{g.total_in > 0 ? fmtAmt(g.total_in) : ''}</td>
                          <td className="px-4 py-2 text-right font-mono text-red-700">{g.total_out > 0 ? fmtAmt(g.total_out) : ''}</td>
                          <td className={`px-4 py-2 text-right font-mono font-semibold ${g.balance >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                            {fmtAmt(g.balance)}
                          </td>
                          <td className="px-4 py-2 text-slate-500 text-xs">{g.status ?? ''}</td>
                        </tr>
                        {showTxns && (entriesByGroup[g.id] ?? []).map((e) => (
                          <tr key={e.entry_date + e.payee + e.detail}
                            className={`border-b border-slate-50 text-xs text-slate-500 ${i % 2 === 0 ? 'bg-yellow-50/60' : 'bg-white'}`}>
                            <td className="px-4 py-1 pl-8">
                              {fmtDate(e.entry_date)} — {e.payee ?? ''}
                              {e.detail ? <span className="text-slate-400"> — {e.detail}</span> : null}
                            </td>
                            <td></td>
                            <td className="px-4 py-1 text-right font-mono text-green-600">{e.money_in > 0 ? fmtAmt(e.money_in) : ''}</td>
                            <td className="px-4 py-1 text-right font-mono text-red-600">{e.money_out > 0 ? fmtAmt(e.money_out) : ''}</td>
                            <td></td>
                            <td></td>
                          </tr>
                        ))}
                      </>
                    ))}
                    {/* Totals */}
                    {groups.length > 0 && (
                      <tr className="bg-slate-100 border-t border-slate-300 font-bold">
                        <td className="px-4 py-2.5">TOTAL</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">{fmtAmt(totalBf)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-green-700">{fmtAmt(totalIn)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-red-700">{fmtAmt(totalOut)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${totalBf + totalIn - totalOut >= 0 ? 'text-slate-700' : 'text-red-700'}`}>
                          {fmtAmt(totalBf + totalIn - totalOut)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
