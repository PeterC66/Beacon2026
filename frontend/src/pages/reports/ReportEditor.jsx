// beacon2/frontend/src/pages/reports/ReportEditor.jsx
// Create / edit a saved SQL report (site admin only).
// Users write parameterised SELECT/WITH queries using `:paramName` placeholders,
// then declare each placeholder here as name/label/type.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reports as reportsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

export default function ReportEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { isSiteAdmin, tenant } = useAuth();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [sqlText, setSqlText]         = useState('SELECT * FROM members LIMIT 10');
  const [parameters, setParameters]   = useState([]);
  const [loading, setLoading]         = useState(!isNew);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const r = await reportsApi.get(id);
        setName(r.name);
        setDescription(r.description ?? '');
        setSqlText(r.sql_text);
        setParameters(r.parameters ?? []);
      } catch (err) {
        setError(err.body?.error || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sqlText,
        parameters,
      };
      const saved = isNew
        ? await reportsApi.create(payload)
        : await reportsApi.update(id, payload);
      navigate(`/reports/${saved.id}`);
    } catch (err) {
      setError(err.body?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  function addParam() {
    setParameters((prev) => [...prev, { name: '', label: '', type: 'text', required: false }]);
  }

  function updateParam(i, patch) {
    setParameters((prev) => prev.map((p, j) => j === i ? { ...p, ...patch } : p));
  }

  function removeParam(i) {
    setParameters((prev) => prev.filter((_, j) => j !== i));
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
          Only site administrators can create or edit reports.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">
          {isNew ? 'New report' : 'Edit report'}
        </h1>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input className={`${inputCls} w-full`} value={name}
                  onChange={(e) => setName(e.target.value)} required maxLength={120} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input className={`${inputCls} w-full`} value={description}
                  onChange={(e) => setDescription(e.target.value)} maxLength={500} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  SQL (SELECT / WITH only — use <code>:paramName</code> placeholders)
                </label>
                <textarea className={`${inputCls} w-full font-mono text-xs`}
                  value={sqlText} onChange={(e) => setSqlText(e.target.value)}
                  rows={12} required maxLength={10000} />
              </div>
            </div>

            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">Parameters</h2>
                <button type="button" onClick={addParam}
                  className="text-blue-600 hover:underline text-xs">+ Add parameter</button>
              </div>
              {parameters.length === 0 ? (
                <p className="text-xs text-slate-500">No parameters defined.</p>
              ) : (
                <div className="space-y-2">
                  {parameters.map((p, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input className={`${inputCls} sm:col-span-3`} placeholder="name (in SQL)"
                        value={p.name} onChange={(e) => updateParam(i, { name: e.target.value })}
                        pattern="^[a-zA-Z_][a-zA-Z0-9_]*$" />
                      <input className={`${inputCls} sm:col-span-4`} placeholder="label (shown to user)"
                        value={p.label} onChange={(e) => updateParam(i, { label: e.target.value })} />
                      <select className={`${inputCls} sm:col-span-2`}
                        value={p.type} onChange={(e) => updateParam(i, { type: e.target.value })}>
                        <option value="text">text</option>
                        <option value="number">number</option>
                        <option value="date">date</option>
                        <option value="boolean">boolean</option>
                      </select>
                      <label className="sm:col-span-2 text-xs text-slate-700 inline-flex items-center gap-1">
                        <input type="checkbox" checked={!!p.required}
                          onChange={(e) => updateParam(i, { required: e.target.checked })} />
                        required
                      </label>
                      <button type="button" onClick={() => removeParam(i)}
                        className="sm:col-span-1 text-red-600 hover:underline text-xs text-left">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving || !name.trim() || !sqlText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => navigate('/reports')}
                className="border border-slate-300 rounded px-5 py-2 text-sm hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
