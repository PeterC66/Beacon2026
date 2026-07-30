// beacon2026/frontend/src/pages/system/SystemDashboard.jsx
// Tenant management: list tenants, create new ones, enable/disable, restore backups.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { system, getSysToken, clearSysToken } from '../../lib/api.js';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';
import { EMPTY_FORM, SECTIONS } from './systemDashboardConstants.js';
import CreateTenantForm from './CreateTenantForm.jsx';
import RestoreBackupSection from './RestoreBackupSection.jsx';
import RestoreConfirmModal from './RestoreConfirmModal.jsx';
import FeatureConfigModal from './FeatureConfigModal.jsx';

export default function SystemDashboard() {
  const navigate = useNavigate();
  const token = getSysToken();

  const [tenants, setTenants] = useState([]);
  const { sorted: sortedTenants, sortKey, sortDir, onSort } = useSortedData(tenants);
  const [loadErr, setLoadErr] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [success, setSuccess] = useState(null);

  // System message state
  const [sysMessage, setSysMessage] = useState('');
  const [sysMessageOrig, setSysMessageOrig] = useState('');
  const [sysMessageSaving, setSysMessageSaving] = useState(false);
  const [sysMessageSaved, setSysMessageSaved] = useState(false);

  // Feature config modal state
  const [fcTenant, setFcTenant] = useState(null); // { slug, name } of tenant being edited
  const [fcConfig, setFcConfig] = useState({});
  const [fcSaved, setFcSaved] = useState({});
  const [fcLoading, setFcLoading] = useState(false);
  const [fcSaving, setFcSaving] = useState(false);
  const [fcError, setFcError] = useState(null);
  const [fcSuccess, setFcSuccess] = useState(false);

  // Restore state
  const restoreFileRef = useRef(null);
  const [restoreTenant, setRestoreTenant] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const logout = () => {
    clearSysToken();
    navigate('/system/login');
  };

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
    if (!token) {
      navigate('/system/login');
      return;
    }
    loadTenants();
    system
      .getSettings(token)
      .then((s) => {
        setSysMessage(s.systemMessage ?? '');
        setSysMessageOrig(s.systemMessage ?? '');
      })
      .catch(() => {});
  }, [token, navigate, loadTenants]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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
    if (pw.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    try {
      const result = await system.setTempPassword(token, tenant.id, pw);
      setSuccess(
        `Temporary password set for ${result.updated} user(s) in "${tenant.name}": ${result.users.join(', ')}`,
      );
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
              onClick={() => {
                setShowForm((v) => !v);
                setFormErr(null);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {showForm ? 'Cancel' : '+ New tenant'}
            </button>
          </div>

          {loadErr && <p className="text-red-600 text-sm mb-3">{loadErr}</p>}

          {tenants.length === 0 && !loadErr ? (
            <p className="text-slate-400 text-sm">No tenants yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <SortableHeader
                    col="name"
                    label="Name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                    className="pb-2 font-medium"
                  />
                  <SortableHeader
                    col="slug"
                    label="Slug"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                    className="pb-2 font-medium"
                  />
                  <SortableHeader
                    col="active"
                    label="Status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                    className="pb-2 font-medium"
                  />
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedTenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-3">{t.name}</td>
                    <td className="py-3 font-mono text-slate-600">{t.slug}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                      >
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
          <CreateTenantForm
            form={form}
            setForm={setForm}
            handleChange={handleChange}
            handleCreate={handleCreate}
            saving={saving}
            formErr={formErr}
          />
        )}

        {/* System Message */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-1">System Message</h2>
          <p className="text-sm text-slate-500 mb-4">
            This message is displayed on the Home page of every tenant. Use it for system-wide
            announcements.
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
            {sysMessageSaved && <span className="text-green-600 text-sm font-medium">Saved</span>}
          </div>
        </section>

        {/* Restore from Backup */}
        <RestoreBackupSection
          tenants={tenants}
          restoreFileRef={restoreFileRef}
          restoreTenant={restoreTenant}
          setRestoreTenant={setRestoreTenant}
          restoreFile={restoreFile}
          restoring={restoring}
          restoreResult={restoreResult}
          setRestoreResult={setRestoreResult}
          restoreError={restoreError}
          setRestoreError={setRestoreError}
          handleRestoreFileChange={handleRestoreFileChange}
          handleRestoreClick={handleRestoreClick}
        />
      </main>

      {/* Restore confirmation modal */}
      {confirmOpen && (
        <RestoreConfirmModal
          restoreTenant={restoreTenant}
          restoreFile={restoreFile}
          setConfirmOpen={setConfirmOpen}
          handleConfirmRestore={handleConfirmRestore}
        />
      )}

      {/* Feature config modal */}
      {fcTenant && (
        <FeatureConfigModal
          fcTenant={fcTenant}
          fcConfig={fcConfig}
          fcLoading={fcLoading}
          fcSaving={fcSaving}
          fcError={fcError}
          fcSuccess={fcSuccess}
          fcDirty={fcDirty}
          handleFcChange={handleFcChange}
          handleFcSave={handleFcSave}
          setFcTenant={setFcTenant}
        />
      )}
    </div>
  );
}
