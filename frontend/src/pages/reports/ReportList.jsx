// beacon2/frontend/src/pages/reports/ReportList.jsx
// List saved SQL reports. Admins see Edit/Delete/New/Ad-hoc SQL actions.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reports as reportsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

export default function ReportList() {
  const { can, isSiteAdmin, tenant } = useAuth();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const canRun = can('reports', 'run');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try { setList(await reportsApi.list()); }
    catch (err) { setError(err.message); }
    finally    { setLoading(false); }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete report "${name}"? This cannot be undone.`)) return;
    try {
      await reportsApi.remove(id);
      setList((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.body?.error || err.message);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(isSiteAdmin ? [
      { label: 'New report',   to: '/reports/new' },
      { label: 'Ad-hoc SQL',   to: '/reports/sql' },
    ] : []),
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">SQL Reports</h1>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-6">
            No reports yet.{isSiteAdmin ? ' Add one from the menu above.' : ''}
          </p>
        ) : (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                  <th className="px-4 py-2 font-normal">Name</th>
                  <th className="px-4 py-2 font-normal">Description</th>
                  <th className="px-4 py-2 font-normal text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                    <td className="px-4 py-2">
                      {canRun
                        ? <Link to={`/reports/${r.id}`} className="text-blue-700 hover:underline">{r.name}</Link>
                        : r.name}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.description ?? ''}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                      {isSiteAdmin && (
                        <>
                          <Link to={`/reports/${r.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                          <button onClick={() => handleDelete(r.id, r.name)}
                            className="text-red-600 hover:underline text-xs">Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
