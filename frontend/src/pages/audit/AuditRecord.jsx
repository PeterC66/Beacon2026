// beacon2/frontend/src/pages/audit/AuditRecord.jsx
// Audit record detail view — doc 9.2(a)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { audit as auditApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

export default function AuditRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await auditApi.get(id);
        if (!cancelled) setEntry(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatTarget(entry) {
    if (!entry.entity_name && !entry.entity_id) return '';
    if (entry.entity_name && entry.entity_id) return `${entry.entity_name} [${entry.entity_id}]`;
    return entry.entity_name || entry.entity_id;
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Audit Log', to: '/audit' },
  ];

  const fields = entry ? [
    { label: 'Audit No',   value: entry.id },
    { label: 'Audit Date', value: formatDate(entry.created_at) },
    { label: 'User',       value: entry.user_name },
    { label: 'Action',     value: entry.action },
    { label: 'Target',     value: formatTarget(entry) },
    { label: 'Data',       value: entry.detail ?? '' },
    { label: 'Entity',     value: entry.entity_type },
  ] : [];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Audit Record</h1>

        {loading && <p className="text-center text-slate-500 py-6">Loading…</p>}
        {error && <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm text-center mb-4">{error}</p>}

        {entry && (
          <div className="bg-amber-100/80 rounded-lg shadow-sm overflow-hidden">
            <dl className="divide-y divide-amber-200/60">
              {fields.map(({ label, value }) => (
                <div key={label} className="px-4 py-2.5 flex">
                  <dt className="w-32 shrink-0 font-medium text-sm text-slate-700">{label}</dt>
                  <dd className="text-sm text-slate-900 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
