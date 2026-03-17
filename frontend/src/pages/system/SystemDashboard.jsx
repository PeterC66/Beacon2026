// beacon2/frontend/src/pages/system/SystemDashboard.jsx
// Tenant management: list tenants, create new ones, enable/disable, restore backups.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { system } from '../../lib/api.js';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const EMPTY_FORM = { name: '', slug: '', adminEmail: '', adminName: '', adminPassword: '', adminUsername: '' };

export default function SystemDashboard() {
  const navigate  = useNavigate();
  const token     = sessionStorage.getItem('sysToken');

  const [tenants,  setTenants]  = useState([]);
  const { sorted: sortedTenants, sortKey, sortDir, onSort } = useSortedData(tenants);
  const [loadErr,  setLoadErr]  = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState(null);
  const [success,  setSuccess]  = useState(null);

  // Restore state
  const restoreFileRef = useRef(null);
  const [restoreTenant,  setRestoreTenant]  = useState('');
  const [restoreFile,    setRestoreFile]    = useState(null);
  const [restoring,      setRestoring]      = useState(false);
  const [restoreResult,  setRestoreResult]  = useState(null);
  const [restoreError,   setRestoreError]   = useState('');
  const [confirmOpen,    setConfirmOpen]    = useState(false);

  const logout = () => { sessionStorage.removeItem('sysToken'); navigate('/system/login'); };

  const loadTenants = useCallback(async () => {
    setLoadErr(null);
    try {
      setTenants(await system.listTenants(token));
    } catch (err) {
      if (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized')) {
        logout();
      } else {
        setLoadErr(err.message);
      }
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) { navigate('/system/login'); return; }
    loadTenants();
  }, [token, navigate, loadTenants]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormErr(null);
    setSuccess(null);
    setSaving(true);
    try {
      await system.createTenant(token, form);
      setSuccess(`Tenant "${form.name}" created. Users can now log in with slug "${form.slug}".`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadTenants();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tenant) => {
    try {
      await system.setTenantActive(token, tenant.id, !tenant.active);
      loadTenants();
    } catch (err) {
      setLoadErr(err.message);
    }
  };

  function handleRestoreFileChange(e) {
    setRestoreFile(e.target.files[0] || null);
    setRestoreResult(null);
    setRestoreError('');
  }

  function handleRestoreClick() {
    if (!restoreTenant || !restoreFile) return;
    setConfirmOpen(true);
  }

  async function handleConfirmRestore() {
    setConfirmOpen(false);
    setRestoring(true);
    setRestoreResult(null);
    setRestoreError('');
    try {
      const result = await system.restoreBackup(token, restoreTenant, restoreFile);
      setRestoreResult(result);
      setRestoreFile(null);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    } catch (err) {
      setRestoreError(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">
          Beacon<span className="text-blue-600">2</span>
          <span className="text-slate-400 font-normal text-base ml-2">/ System Admin</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">v{__APP_VERSION__}</span>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Success banner */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {success}
          </div>
        )}

        {/* Tenants table */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700">u3a Tenants</h2>
            <button
              onClick={() => { setShowForm((v) => !v); setFormErr(null); }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {showForm ? 'Cancel' : '+ New tenant'}
            </button>
          </div>

          {loadErr && (
            <p className="text-red-600 text-sm mb-3">{loadErr}</p>
          )}

          {tenants.length === 0 && !loadErr ? (
            <p className="text-slate-400 text-sm">No tenants yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <SortableHeader col="name"   label="Name"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="pb-2 font-medium" />
                  <SortableHeader col="slug"   label="Slug"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="pb-2 font-medium" />
                  <SortableHeader col="active" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="pb-2 font-medium" />
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedTenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-3">{t.name}</td>
                    <td className="py-3 font-mono text-slate-600">{t.slug}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {t.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => toggleActive(t)}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        {t.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Create tenant form */}
        {showForm && (
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Create new tenant</h2>

            {formErr && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formErr}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">u3a name</label>
                  <input name="name" value={form.name} onChange={handleChange} required
                    placeholder="e.g. Oxfordshire u3a"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                  <input name="slug" value={form.slug} onChange={handleChange} required
                    placeholder="e.g. oxfordshire"
                    pattern="[a-z0-9_]+"
                    title="Lowercase letters, numbers and underscores only"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces. Users will type this at login.</p>
                </div>
              </div>

              <hr className="border-slate-100" />
              <p className="text-sm font-medium text-slate-600">First admin user</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input name="adminName" value={form.adminName} onChange={handleChange} required
                    placeholder="e.g. Jane Smith"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input name="adminUsername" value={form.adminUsername}
                  onChange={(e) => setForm((f) => ({ ...f, adminUsername: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                  required pattern="[a-z0-9]+"
                  title="Lowercase letters and numbers only"
                  placeholder="e.g. jsmith"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-slate-400 mt-1">Used to log in. Lowercase letters and numbers only.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange}
                  required minLength={8}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
              </div>

              <button type="submit" disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {saving ? 'Creating…' : 'Create tenant'}
              </button>
            </form>
          </section>
        )}

        {/* Restore from Backup */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-1">Restore from Backup</h2>
          <p className="text-sm text-slate-500 mb-4">
            Upload a Beacon2 backup or a legacy Beacon export file to restore a tenant&apos;s data.
            The format is detected automatically. User accounts and roles are included in the restore.
          </p>

          <div className="rounded-md bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800 text-sm mb-5">
            <strong>Warning:</strong> Restoring will <strong>permanently delete all current data</strong> for
            the selected tenant and replace it with the contents of the uploaded file. This cannot be undone.
          </div>

          {restoreError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium">
              {restoreError}
            </div>
          )}

          {restoreResult && (
            <div className="mb-4 rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-800 text-sm font-medium">
              ✓ {restoreResult.message}
              {restoreResult.format === 'beacon' && (
                <span className="ml-2 text-xs font-normal">(migrated from Beacon)</span>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select tenant</label>
              <select
                value={restoreTenant}
                onChange={(e) => { setRestoreTenant(e.target.value); setRestoreResult(null); setRestoreError(''); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— choose a tenant —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.slug}>{t.name} ({t.slug})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select backup file (.xlsx)
              </label>
              <input
                ref={restoreFileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleRestoreFileChange}
                className="block text-sm text-slate-600
                  file:mr-3 file:py-2 file:px-4 file:rounded file:border-0
                  file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {restoreFile && (
                <p className="text-xs text-slate-500 mt-1">{restoreFile.name} ({(restoreFile.size / 1024).toFixed(0)} KB)</p>
              )}
            </div>

            <button
              onClick={handleRestoreClick}
              disabled={!restoreTenant || !restoreFile || restoring}
              className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {restoring ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Restoring…
                </>
              ) : (
                'Restore from this file'
              )}
            </button>
          </div>
        </section>

      </main>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Confirm restore</h3>
            <p className="text-sm text-slate-600 mb-1">
              Tenant: <strong>{restoreTenant}</strong>
            </p>
            <p className="text-sm text-slate-600 mb-2">
              File:
            </p>
            <p className="text-sm font-medium text-slate-800 bg-slate-100 rounded px-3 py-2 mb-4 break-all">
              {restoreFile?.name}
            </p>
            <p className="text-sm text-red-700 font-medium mb-5">
              All current data for this tenant will be permanently deleted and replaced.
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="bg-red-600 hover:bg-red-700 text-white rounded px-5 py-2 text-sm font-medium"
              >
                Yes, restore now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
