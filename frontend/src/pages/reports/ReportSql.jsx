// beacon2/frontend/src/pages/reports/ReportSql.jsx
// Ad-hoc SQL editor (site admin only). Runs SELECT/WITH queries against the
// tenant schema in a read-only transaction with a statement timeout.

import { useState } from 'react';
import { reports as reportsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import ReportResults from './ReportResults.jsx';

export default function ReportSql() {
  const { isSiteAdmin, tenant } = useAuth();

  const [sql, setSql]         = useState('SELECT * FROM members LIMIT 10');
  const [running, setRunning] = useState(false);
  const [downloading, setDown] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await reportsApi.runSql(sql));
    } catch (err) {
      setError(err.body?.error || err.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload() {
    setDown(true);
    setError(null);
    try {
      await reportsApi.downloadSql(sql);
    } catch (err) {
      setError(err.body?.error || err.message);
    } finally {
      setDown(false);
    }
  }

  const navLinks = [
    { label: 'Home',    to: '/' },
    { label: 'Reports', to: '/reports' },
  ];

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (!isSiteAdmin) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <p className="text-center text-red-600 py-8 text-sm">
          Only site administrators can run ad-hoc SQL.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-1">Ad-hoc SQL</h1>
        <p className="text-sm text-slate-600 text-center mb-4">
          Read-only queries only — SELECT or WITH, single statement. Runs against your tenant schema.
        </p>

        <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-4">
          <textarea className={`${inputCls} w-full font-mono text-xs`}
            value={sql} onChange={(e) => setSql(e.target.value)}
            rows={10} maxLength={20000}
            placeholder="SELECT …" />
          <div className="flex gap-2 mt-3">
            <button onClick={handleRun} disabled={running || !sql.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium">
              {running ? 'Running…' : 'Run'}
            </button>
            {result && result.rowCount > 0 && (
              <button onClick={handleDownload} disabled={downloading}
                className="border border-slate-300 rounded px-5 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
                {downloading ? 'Preparing…' : 'Download Excel'}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <ReportResults result={result} />
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
