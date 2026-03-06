// beacon2/frontend/src/pages/system/SystemDashboard.jsx
// Tenant management: list tenants, create new ones, enable/disable.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { system } from '../../lib/api.js';

const EMPTY_FORM = { name: '', slug: '', adminEmail: '', adminName: '', adminPassword: '' };

export default function SystemDashboard() {
  const navigate  = useNavigate();
  const token     = sessionStorage.getItem('sysToken');

  const [tenants,  setTenants]  = useState([]);
  const [loadErr,  setLoadErr]  = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState(null);
  const [success,  setSuccess]  = useState(null);

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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">
          Beacon<span className="text-blue-600">2</span>
          <span className="text-slate-400 font-normal text-base ml-2">/ System Admin</span>
        </h1>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
          Sign out
        </button>
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
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Slug</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
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
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
      </main>
    </div>
  );
}
