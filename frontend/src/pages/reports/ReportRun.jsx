// beacon2/frontend/src/pages/reports/ReportRun.jsx
// Run a saved SQL report — parameter inputs, Run button, results table, Excel download.

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reports as reportsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import ReportResults from './ReportResults.jsx';

export default function ReportRun() {
  const { id } = useParams();
  const { can, isSiteAdmin, tenant } = useAuth();

  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [values, setValues]     = useState({});
  const [running, setRunning]   = useState(false);
  const [downloading, setDown]  = useState(false);
  const [result, setResult]     = useState(null);
  const [runError, setRunError] = useState(null);

  const canRun = can('reports', 'run');

  useEffect(() => {
    (async () => {
      try {
        const r = await reportsApi.get(id);
        setReport(r);
        const initial = {};
        for (const p of r.parameters || []) {
          initial[p.name] = p.default ?? '';
        }
        setValues(initial);
      } catch (err) {
        setError(err.body?.error || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      setResult(await reportsApi.run(id, values));
    } catch (err) {
      setRunError(err.body?.error || err.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload() {
    setDown(true);
    setRunError(null);
    try {
      await reportsApi.download(id, values);
    } catch (err) {
      setRunError(err.body?.error || err.message);
    } finally {
      setDown(false);
    }
  }

  const navLinks = [
    { label: 'Home',    to: '/' },
    { label: 'Reports', to: '/reports' },
    ...(isSiteAdmin ? [{ label: 'Edit', to: `/reports/${id}/edit` }] : []),
  ];

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-4">
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : report && (
          <>
            <h1 className="text-xl font-bold text-center mb-1">{report.name}</h1>
            {report.description && (
              <p className="text-sm text-slate-600 text-center mb-4">{report.description}</p>
            )}

            {(report.parameters || []).length > 0 && (
              <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Parameters</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.parameters.map((p) => (
                    <div key={p.name}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {p.label}{p.required ? <span className="text-red-600"> *</span> : null}
                      </label>
                      <ParamInput
                        param={p}
                        value={values[p.name] ?? ''}
                        onChange={(v) => setValues((prev) => ({ ...prev, [p.name]: v }))}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button
                onClick={handleRun}
                disabled={!canRun || running}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium">
                {running ? 'Running…' : 'Run'}
              </button>
              {result && result.rowCount > 0 && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="border border-slate-300 rounded px-5 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
                  {downloading ? 'Preparing…' : 'Download Excel'}
                </button>
              )}
              {!canRun && (
                <p className="text-xs text-slate-500 self-center">You do not have permission to run reports.</p>
              )}
            </div>

            {runError && <p className="text-red-600 text-sm mb-3">{runError}</p>}

            <ReportResults result={result} />

            {isSiteAdmin && (
              <details className="mt-4 text-xs text-slate-600">
                <summary className="cursor-pointer">Show SQL</summary>
                <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded overflow-x-auto whitespace-pre-wrap">{report.sql_text}</pre>
              </details>
            )}
          </>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}

function ParamInput({ param, value, onChange, className }) {
  if (param.type === 'boolean') {
    return (
      <select value={value === true || value === 'true' ? 'true' : 'false'}
              onChange={(e) => onChange(e.target.value === 'true')}
              className={className}>
        <option value="false">No</option>
        <option value="true">Yes</option>
      </select>
    );
  }
  const type = param.type === 'number' ? 'number'
             : param.type === 'date'   ? 'date'
             : 'text';
  return (
    <input type={type} className={className} value={value}
           onChange={(e) => onChange(e.target.value)}
           required={param.required} />
  );
}
