// beacon2/frontend/src/pages/system/SystemDashboard.jsx
// Tenant management: list tenants, create new ones, enable/disable, restore backups.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { system, getSysToken, clearSysToken } from '../../lib/api.js';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const EMPTY_FORM = { name: '', slug: '', adminEmail: '', adminName: '', adminPassword: '', adminUsername: '' };

// ─── Feature toggle definitions (same structure as FeatureConfig.jsx) ────────
const SECTIONS = [
  {
    title: 'Membership',
    master: null,
    toggles: [
      { key: 'membershipCards',     label: 'Membership Cards',     defaultValue: true },
      { key: 'membershipRenewals',  label: 'Membership Renewals',  defaultValue: true },
      { key: 'addressesExport',     label: 'Addresses Export',     defaultValue: true },
      { key: 'giftAid',            label: 'Gift Aid',             defaultValue: false },
      { key: 'customFields',       label: 'Custom Fields',        defaultValue: true },
      { key: 'polls',              label: 'Polls',                defaultValue: true },
      { key: 'statistics',         label: 'Membership Statistics', defaultValue: true },
    ],
  },
  {
    title: 'Groups',
    master: { key: 'groups', label: 'Groups module', defaultValue: true },
    toggles: [
      { key: 'teams',       label: 'Teams',         defaultValue: true,  dependsOn: 'groups' },
      { key: 'venues',      label: 'Venues',        defaultValue: true,  dependsOn: 'groups' },
      { key: 'faculties',   label: 'Faculties',     defaultValue: true,  dependsOn: 'groups' },
      { key: 'groupLedger', label: 'Group Ledger',  defaultValue: false, dependsOn: 'groups' },
      { key: 'siteworks',   label: 'SiteWorks',     defaultValue: false, dependsOn: 'groups' },
    ],
  },
  {
    title: 'Events & Calendar',
    master: { key: 'events', label: 'Events & Calendar module', defaultValue: true },
    toggles: [
      { key: 'calendar',   label: 'Calendar',    defaultValue: true, dependsOn: 'events' },
      { key: 'eventTypes', label: 'Event Types',  defaultValue: true, dependsOn: 'events' },
    ],
  },
  {
    title: 'Finance',
    master: { key: 'finance', label: 'Finance module', defaultValue: true },
    toggles: [
      { key: 'creditBatches',      label: 'Credit Batches',      defaultValue: true, dependsOn: 'finance' },
      { key: 'reconciliation',     label: 'Reconciliation',      defaultValue: true, dependsOn: 'finance' },
      { key: 'financialStatement', label: 'Financial Statement',  defaultValue: true, dependsOn: 'finance' },
      { key: 'groupsStatement',    label: 'Groups Statement',    defaultValue: true, dependsOn: 'finance' },
      { key: 'transferMoney',      label: 'Transfer Money',      defaultValue: true, dependsOn: 'finance' },
    ],
  },
  {
    title: 'Email & Letters',
    master: { key: 'email', label: 'Email & Letters module', defaultValue: true },
    toggles: [],
  },
  {
    title: 'Members Portal',
    master: { key: 'portal', label: 'Members Portal', defaultValue: true },
    toggles: [],
  },
  {
    title: 'Online Joining',
    master: { key: 'onlineJoining', label: 'Online Joining', defaultValue: true },
    toggles: [],
  },
];

function getVal(config, key, defaultValue) {
  if (key in config) return config[key];
  return defaultValue;
}

export default function SystemDashboard() {
  const navigate  = useNavigate();
  const token     = getSysToken();

  const [tenants,  setTenants]  = useState([]);
  const { sorted: sortedTenants, sortKey, sortDir, onSort } = useSortedData(tenants);
  const [loadErr,  setLoadErr]  = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState(null);
  const [success,  setSuccess]  = useState(null);

  // System message state
  const [sysMessage,      setSysMessage]     = useState('');
  const [sysMessageOrig,  setSysMessageOrig] = useState('');
  const [sysMessageSaving, setSysMessageSaving] = useState(false);
  const [sysMessageSaved,  setSysMessageSaved]  = useState(false);

  // Feature config modal state
  const [fcTenant,  setFcTenant]  = useState(null);  // { slug, name } of tenant being edited
  const [fcConfig,  setFcConfig]  = useState({});
  const [fcSaved,   setFcSaved]   = useState({});
  const [fcLoading, setFcLoading] = useState(false);
  const [fcSaving,  setFcSaving]  = useState(false);
  const [fcError,   setFcError]   = useState(null);
  const [fcSuccess, setFcSuccess] = useState(false);

  // Restore state
  const restoreFileRef = useRef(null);
  const [restoreTenant,  setRestoreTenant]  = useState('');
  const [restoreFile,    setRestoreFile]    = useState(null);
  const [restoring,      setRestoring]      = useState(false);
  const [restoreResult,  setRestoreResult]  = useState(null);
  const [restoreError,   setRestoreError]   = useState('');
  const [confirmOpen,    setConfirmOpen]    = useState(false);

  const logout = () => { clearSysToken(); navigate('/system/login'); };

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
    system.getSettings(token)
      .then((s) => { setSysMessage(s.systemMessage ?? ''); setSysMessageOrig(s.systemMessage ?? ''); })
      .catch(() => {});
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

  const handleDeleteTenant = async (tenant) => {
    const confirmed = window.confirm(
      `PERMANENTLY DELETE tenant "${tenant.name}" (${tenant.slug})?\n\nThis will drop all data for this u3a and cannot be undone. Type the slug to confirm.`,
    );
    if (!confirmed) return;
    const slug = window.prompt(`Type the slug "${tenant.slug}" to confirm deletion:`);
    if (slug !== tenant.slug) {
      alert('Slug did not match. Deletion cancelled.');
      return;
    }
    try {
      await system.deleteTenant(token, tenant.id);
      setSuccess(`Tenant "${tenant.name}" permanently deleted.`);
      loadTenants();
    } catch (err) {
      setLoadErr(err.message);
    }
  };

  const handleSetTempPassword = async (tenant) => {
    const pw = window.prompt(
      `Set a temporary password for ALL users in "${tenant.name}".\n\nEnter the temporary password (min 6 chars):`,
    );
    if (!pw) return;
    if (pw.length < 6) { alert('Password must be at least 6 characters.'); return; }
    try {
      const result = await system.setTempPassword(token, tenant.id, pw);
      setSuccess(`Temporary password set for ${result.updated} user(s) in "${tenant.name}": ${result.users.join(', ')}`);
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

  async function handleSaveSystemMessage() {
    setSysMessageSaving(true);
    setSysMessageSaved(false);
    try {
      const result = await system.updateSettings(token, { systemMessage: sysMessage });
      setSysMessageOrig(result.systemMessage ?? '');
      setSysMessageSaved(true);
      setTimeout(() => setSysMessageSaved(false), 3000);
    } catch (err) {
      setLoadErr(err.message);
    } finally {
      setSysMessageSaving(false);
    }
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

  async function openFeatureConfig(tenant) {
    setFcTenant(tenant);
    setFcLoading(true);
    setFcError(null);
    setFcSuccess(false);
    try {
      const cfg = await system.getFeatureConfig(token, tenant.slug);
      setFcConfig(cfg);
      setFcSaved(cfg);
    } catch (err) {
      setFcError(err.message);
    } finally {
      setFcLoading(false);
    }
  }

  function handleFcChange(key, value) {
    setFcConfig((prev) => ({ ...prev, [key]: value }));
    setFcSuccess(false);
  }

  async function handleFcSave() {
    // Build diff
    const diff = {};
    for (const section of SECTIONS) {
      if (section.master) {
        const k = section.master.key;
        const cur = fcConfig[k] ?? section.master.defaultValue;
        const prev = fcSaved[k] ?? section.master.defaultValue;
        if (cur !== prev) diff[k] = fcConfig[k] ?? section.master.defaultValue;
      }
      for (const t of section.toggles) {
        const cur = fcConfig[t.key] ?? t.defaultValue;
        const prev = fcSaved[t.key] ?? t.defaultValue;
        if (cur !== prev) diff[t.key] = fcConfig[t.key] ?? t.defaultValue;
      }
    }
    // Also catch explicitly changed keys not in SECTIONS defaults
    for (const key of Object.keys(fcConfig)) {
      if (fcConfig[key] !== fcSaved[key] && !(key in diff)) diff[key] = fcConfig[key];
    }
    if (Object.keys(diff).length === 0) return;

    setFcSaving(true);
    setFcError(null);
    try {
      const updated = await system.updateFeatureConfig(token, fcTenant.slug, diff);
      setFcConfig(updated);
      setFcSaved(updated);
      setFcSuccess(true);
      setTimeout(() => setFcSuccess(false), 3000);
    } catch (err) {
      setFcError(err.message);
    } finally {
      setFcSaving(false);
    }
  }

  const fcDirty = fcTenant && JSON.stringify(fcConfig) !== JSON.stringify(fcSaved);

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
                    <td className="py-3 text-right space-x-4">
                      <button
                        onClick={() => toggleActive(t)}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        {t.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => openFeatureConfig(t)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                        title="View and edit feature toggles for this tenant"
                      >
                        Features
                      </button>
                      <button
                        onClick={() => handleSetTempPassword(t)}
                        className="text-xs text-amber-600 hover:text-amber-800 underline"
                        title="Set a temporary password for all users in this tenant"
                      >
                        Set password
                      </button>
                      <button
                        onClick={() => handleDeleteTenant(t)}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Delete
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

        {/* System Message */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-1">System Message</h2>
          <p className="text-sm text-slate-500 mb-4">
            This message is displayed on the Home page of every tenant. Use it for system-wide announcements.
          </p>
          <textarea
            value={sysMessage}
            onChange={(e) => setSysMessage(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="<<System Message here>>"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSaveSystemMessage}
              disabled={sysMessageSaving || sysMessage === sysMessageOrig}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {sysMessageSaving ? 'Saving…' : 'Save'}
            </button>
            {sysMessageSaved && (
              <span className="text-green-600 text-sm font-medium">Saved</span>
            )}
          </div>
        </section>

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
            <div className="mb-4 rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-800 text-sm font-medium whitespace-pre-line">
              ✓ {restoreResult.message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select tenant</label>
              <select
                name="restoreTenant"
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

      {/* Restore confirmation modal */}
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

      {/* Feature config modal */}
      {fcTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg mx-4 w-full max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                Feature Configuration
              </h3>
              <p className="text-sm text-slate-500">{fcTenant.name} ({fcTenant.slug})</p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {fcLoading && <p className="text-center text-slate-500 py-4">Loading...</p>}

              {fcError && (
                <p className="rounded-md bg-red-50 border border-red-300 px-3 py-2 text-red-700 text-sm">
                  {fcError}
                </p>
              )}

              {fcSuccess && (
                <p className="rounded-md bg-green-50 border border-green-300 px-3 py-2 text-green-700 text-sm font-medium">
                  Feature configuration saved.
                </p>
              )}

              {!fcLoading && SECTIONS.map((section) => {
                const masterOn = section.master
                  ? getVal(fcConfig, section.master.key, section.master.defaultValue)
                  : true;
                return (
                  <div key={section.title} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-2 font-semibold text-sm text-slate-800">
                      {section.title}
                    </div>
                    <div className="px-4 py-2 space-y-1">
                      {section.master && (
                        <label className="flex items-center gap-3 py-1 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={masterOn}
                            onChange={(e) => handleFcChange(section.master.key, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-medium text-slate-700">{section.master.label}</span>
                        </label>
                      )}
                      {section.toggles.length > 0 && (
                        <div className="pl-6 space-y-1">
                          {section.toggles.map((t) => {
                            const parentOff = t.dependsOn && !getVal(fcConfig, t.dependsOn, true);
                            const checked = parentOff ? false : getVal(fcConfig, t.key, t.defaultValue);
                            return (
                              <label
                                key={t.key}
                                className={`flex items-center gap-3 py-0.5 text-sm ${parentOff ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={parentOff}
                                  onChange={(e) => handleFcChange(t.key, e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-slate-700">{t.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setFcTenant(null)}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm"
              >
                {fcDirty ? 'Cancel' : 'Close'}
              </button>
              {fcDirty && (
                <button
                  onClick={handleFcSave}
                  disabled={fcSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium"
                >
                  {fcSaving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
