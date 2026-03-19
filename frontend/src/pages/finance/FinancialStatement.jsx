// beacon2/frontend/src/pages/finance/FinancialStatement.jsx
// Receipts & Payments report and Balance Sheet (doc 7.6).

import { useState, useEffect } from 'react';
import { finance as financeApi, requestBlob } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function fmtAmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinancialStatement() {
  const { can, tenant } = useAuth();
  const [accounts,     setAccounts]     = useState([]);
  const [accountId,    setAccountId]    = useState('all');
  const [year,         setYear]         = useState(CURRENT_YEAR);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [error,        setError]        = useState(null);
  const [downloading,  setDownloading]  = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    try { setAccounts(await financeApi.listAccounts()); }
    catch (err) { setError(err.message); }
    finally { setLoadingAccts(false); }
  }

  async function handleView(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const d = await financeApi.getStatement(accountId, year);
      setData(d);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await requestBlob(`/finance/statement/download?accountId=${encodeURIComponent(accountId)}&year=${year}&format=xlsx`);
    } catch (err) { alert(err.message); }
    finally { setDownloading(false); }
  }

  const canDownload = can('finance_statement', 'download');
  const navLinks    = [{ label: 'Home', to: '/' }, { label: 'Finance ledger', to: '/finance/ledger?view=account' }];

  // Organise categories
  const receipts = data ? data.categoryRows.filter((r) => r.type === 'in')  : [];
  const payments  = data ? data.categoryRows.filter((r) => r.type === 'out') : [];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-2">Financial Statement</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          Receipts &amp; Payments report and Balance Sheet.
        </p>

        {/* Selector form */}
        <form onSubmit={handleView} className="bg-white/90 rounded-lg shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputCls} w-full`}>
                <option value="all">All accounts combined</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Financial year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputCls} w-full`}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-3 flex-wrap">
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Loading…' : 'View Statement'}
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
            {/* Period header */}
            <div className="text-center mb-4">
              <p className="text-base font-semibold text-slate-700">{data.accountLabel}</p>
              <p className="text-sm text-slate-500">Financial Year {data.yearNum} ({data.yearStart} to {data.yearEnd})</p>
            </div>

            {/* Receipts & Payments */}
            <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden mb-4">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                <h2 className="font-semibold text-slate-700">Receipts &amp; Payments</h2>
              </div>

              {/* Receipts */}
              <div className="px-4 pt-3 pb-1">
                <h3 className="text-sm font-semibold text-green-700 mb-1">Receipts (Income)</h3>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {receipts.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-2 text-slate-400 italic text-xs">No categorised receipts.</td></tr>
                  )}
                  {receipts.map((r) => (
                    <tr key={r.category} className="border-b border-slate-50">
                      <td className="px-4 py-1.5 text-slate-700">{r.category}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-green-700">{fmtAmt(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-2 font-semibold">Total Receipts</td>
                    <td className="px-4 py-2 text-right font-semibold font-mono text-green-700">{fmtAmt(data.totalIn)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Payments */}
              <div className="px-4 pt-3 pb-1">
                <h3 className="text-sm font-semibold text-red-700 mb-1">Payments (Expenditure)</h3>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {payments.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-2 text-slate-400 italic text-xs">No categorised payments.</td></tr>
                  )}
                  {payments.map((r) => (
                    <tr key={r.category} className="border-b border-slate-50">
                      <td className="px-4 py-1.5 text-slate-700">{r.category}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-red-700">{fmtAmt(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-2 font-semibold">Total Payments</td>
                    <td className="px-4 py-2 text-right font-semibold font-mono text-red-700">{fmtAmt(data.totalOut)}</td>
                  </tr>
                  <tr className="bg-slate-100 border-t border-slate-300">
                    <td className="px-4 py-2 font-bold">Net Surplus / (Deficit)</td>
                    <td className={`px-4 py-2 text-right font-bold font-mono ${data.totalIn - data.totalOut >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmtAmt(data.totalIn - data.totalOut)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Balance Sheet */}
            <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                <h2 className="font-semibold text-slate-700">Balance Sheet</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-700">Opening Balance (brought forward)</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtAmt(data.openingBalance)}</td>
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-700">Plus: Total Receipts</td>
                    <td className="px-4 py-2 text-right font-mono text-green-700">+{fmtAmt(data.totalIn)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Less: Total Payments</td>
                    <td className="px-4 py-2 text-right font-mono text-red-700">−{fmtAmt(data.totalOut)}</td>
                  </tr>
                  <tr className="bg-slate-50 border-t border-slate-300">
                    <td className="px-4 py-2.5 font-bold text-slate-800">Closing Balance</td>
                    <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-800">{fmtAmt(data.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
