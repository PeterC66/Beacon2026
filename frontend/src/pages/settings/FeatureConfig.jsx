// beacon2/frontend/src/pages/settings/FeatureConfig.jsx
// Feature configuration page — toggle modules and sub-features on/off per u3a.

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import { settings as settingsApi } from '../../lib/api.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

// ─── Toggle definitions ──────────────────────────────────────────────────
// Each section has a master toggle (optional) and sub-toggles.
// sysAdminOnly: true means only system admins can change the master toggle.
// dependsOn: parent key — sub-toggle is disabled when parent is off.
// defaultValue: value when key is missing from feature_config (opt-out model).

const SECTIONS = [
  {
    title: 'Membership',
    description: 'Core membership features are always available. These sub-features can be toggled.',
    master: null,
    toggles: [
      { key: 'membershipCards',     label: 'Membership Cards',     defaultValue: true,  tip: 'Generate and download membership cards' },
      { key: 'membershipRenewals',  label: 'Membership Renewals',  defaultValue: true,  tip: 'Process annual renewals and non-renewals' },
      { key: 'addressesExport',     label: 'Addresses Export',     defaultValue: true,  tip: 'Export member addresses for labels or mail merge' },
      { key: 'giftAid',            label: 'Gift Aid',             defaultValue: false, tip: 'Gift Aid declarations, logging, and transaction fields' },
      { key: 'customFields',       label: 'Custom Fields',        defaultValue: true,  tip: 'Up to 4 free-form fields on member records' },
      { key: 'polls',              label: 'Polls',                defaultValue: true,  tip: 'Member polls for filtering and bulk actions' },
      { key: 'statistics',         label: 'Membership Statistics', defaultValue: true,  tip: 'Membership counts and trends' },
    ],
  },
  {
    title: 'Groups',
    description: 'Interest groups, venues, and faculties.',
    master: { key: 'groups', label: 'Groups module', defaultValue: true, tip: 'Groups list, group records, and related features' },
    toggles: [
      { key: 'teams',       label: 'Teams',                  defaultValue: true,  dependsOn: 'groups', tip: 'Separate teams section (committees, working groups, etc.)' },
      { key: 'venues',      label: 'Venues',                 defaultValue: true,  dependsOn: 'groups', tip: 'Venue management for group meetings' },
      { key: 'faculties',   label: 'Faculties',              defaultValue: true,  dependsOn: 'groups', tip: 'Organise groups into subject categories' },
      { key: 'groupLedger', label: 'Group Ledger',           defaultValue: false, dependsOn: 'groups', tip: 'Per-group financial tracking (separate from main finance)' },
      { key: 'siteworks',   label: 'SiteWorks Integration',  defaultValue: false, dependsOn: 'groups', tip: 'When enabled, scheduling is managed in SiteWorks instead of Beacon2' },
    ],
  },
  {
    title: 'Events & Calendar',
    description: 'Calendar views and non-group event types.',
    master: { key: 'events', label: 'Events & Calendar module', defaultValue: true, tip: 'Calendar page and event management' },
    toggles: [
      { key: 'calendar',   label: 'Calendar',    defaultValue: true, dependsOn: 'events', tip: 'Calendar view of group meetings and events' },
      { key: 'eventTypes', label: 'Event Types',  defaultValue: true, dependsOn: 'events', tip: 'Non-group event types (Open Meetings, etc.)' },
    ],
  },
  {
    title: 'Finance',
    description: 'Financial ledger, transactions, statements, and accounts.',
    master: { key: 'finance', label: 'Finance module', defaultValue: true, sysAdminOnly: true, tip: 'Full finance module — requires careful setup' },
    toggles: [
      { key: 'creditBatches',      label: 'Credit Batches',      defaultValue: true, dependsOn: 'finance', tip: 'Group incoming transactions into batches' },
      { key: 'reconciliation',     label: 'Reconciliation',      defaultValue: true, dependsOn: 'finance', tip: 'Match transactions against bank statements' },
      { key: 'financialStatement', label: 'Financial Statement',  defaultValue: true, dependsOn: 'finance', tip: 'Summary of income and expenditure' },
      { key: 'groupsStatement',    label: 'Groups Statement',    defaultValue: true, dependsOn: 'finance', tip: 'Financial summary broken down by group' },
      { key: 'transferMoney',      label: 'Transfer Money',      defaultValue: true, dependsOn: 'finance', tip: 'Transfer funds between accounts' },
    ],
  },
  {
    title: 'Email & Letters',
    description: 'Email sending, delivery tracking, and letter generation. Requires SendGrid configuration.',
    master: { key: 'email', label: 'Email & Letters module', defaultValue: true, sysAdminOnly: true, tip: 'Requires SendGrid setup by system administrator' },
    toggles: [],
  },
  {
    title: 'Members Portal',
    description: 'Online portal for members to view groups, renew, and manage their details.',
    master: { key: 'portal', label: 'Members Portal', defaultValue: true, sysAdminOnly: true, tip: 'Requires infrastructure setup by system administrator' },
    toggles: [],
  },
  {
    title: 'Online Joining',
    description: 'Public online joining form for new members.',
    master: { key: 'onlineJoining', label: 'Online Joining', defaultValue: true, sysAdminOnly: true, tip: 'Requires PayPal setup by system administrator' },
    toggles: [],
  },
];

// ─── Helper: resolve effective value ─────────────────────────────────────

function getVal(config, key, defaultValue) {
  if (key in config) return config[key];
  return defaultValue;
}

// ─── Lock icon SVG ───────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 inline ml-1" viewBox="0 0 20 20" fill="currentColor" title="System administrator only">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Toggle switch component ─────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled, label, tip, sysAdminOnly }) {
  return (
    <label
      className={`flex items-center gap-3 py-1.5 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title={tip}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-slate-700">{label}</span>
      {sysAdminOnly && <LockIcon />}
    </label>
  );
}

// ─── Section component ───────────────────────────────────────────────────

function FeatureSection({ section, config, isSysAdmin, onChange, onConfirmMasterOff }) {
  const [expanded, setExpanded] = useState(true);
  const { master, toggles } = section;

  const masterOn = master ? getVal(config, master.key, master.defaultValue) : true;
  const masterDisabled = master?.sysAdminOnly && !isSysAdmin;

  const handleMasterChange = (val) => {
    if (!val && masterOn) {
      // Turning off — request confirmation
      onConfirmMasterOff(master.key, section.title);
    } else {
      onChange(master.key, val);
    }
  };

  return (
    <section className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 sm:px-6 bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-800">{section.title}</h2>
          {master?.sysAdminOnly && <LockIcon />}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 py-3 sm:px-6 space-y-1">
          {section.description && (
            <p className="text-xs text-slate-500 mb-2">{section.description}</p>
          )}

          {/* Master toggle */}
          {master && (
            <div className="border-b border-slate-100 pb-2 mb-2">
              <ToggleSwitch
                checked={masterOn}
                onChange={handleMasterChange}
                disabled={masterDisabled}
                label={master.label}
                tip={master.tip}
                sysAdminOnly={master.sysAdminOnly}
              />
            </div>
          )}

          {/* Sub-toggles */}
          {toggles.length > 0 && (
            <div className="pl-4 space-y-0.5">
              {toggles.map((t) => {
                const parentOff = t.dependsOn && !getVal(config, t.dependsOn, true);
                const checked = getVal(config, t.key, t.defaultValue);
                return (
                  <ToggleSwitch
                    key={t.key}
                    checked={parentOff ? false : checked}
                    onChange={(val) => onChange(t.key, val)}
                    disabled={parentOff}
                    label={t.label}
                    tip={t.tip}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export default function FeatureConfig() {
  const { tenant, can, refreshFeatureConfig } = useAuth();
  const { markDirty, markClean } = useUnsavedChanges();

  const [config,  setConfig]  = useState({});
  const [saved,   setSaved]   = useState({});   // last-saved snapshot for dirty detection
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);
  const [confirmOff, setConfirmOff] = useState(null); // { key, title } when awaiting confirm

  useEffect(() => {
    settingsApi.getFeatureConfig()
      .then((c) => { setConfig(c); setSaved(c); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = useCallback((key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
    markDirty();
  }, [markDirty]);

  /** Called when a master toggle is being turned off — show confirmation first. */
  const handleConfirmMasterOff = useCallback((key, title) => {
    setConfirmOff({ key, title });
  }, []);

  async function handleSave(e) {
    e.preventDefault();

    // Build the diff — only send changed keys
    const diff = {};
    const allKeys = new Set([...Object.keys(config), ...Object.keys(saved)]);
    for (const key of allKeys) {
      if (config[key] !== saved[key]) diff[key] = config[key];
    }
    // Include keys whose effective value differs from the saved state
    // by also checking defaults from SECTIONS
    for (const section of SECTIONS) {
      if (section.master) {
        const k = section.master.key;
        const cur = config[k] ?? section.master.defaultValue;
        const prev = saved[k] ?? section.master.defaultValue;
        if (cur !== prev && !(k in diff)) diff[k] = cur;
      }
      for (const t of section.toggles) {
        const cur = config[t.key] ?? t.defaultValue;
        const prev = saved[t.key] ?? t.defaultValue;
        if (cur !== prev && !(t.key in diff)) diff[t.key] = cur;
      }
    }

    if (Object.keys(diff).length === 0) {
      markClean();
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await settingsApi.updateFeatureConfig(diff);
      setConfig(updated);
      setSaved(updated);
      markClean();
      await refreshFeatureConfig();
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Tenant users are never system admins — sys admins use SystemDashboard.
  // System-admin-only toggles appear locked on this page.
  const canChange = can('feature_config', 'change');

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ to: '/', label: 'Home' }, { label: 'Feature Configuration' }]} />

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Feature Configuration</h1>
        <p className="text-sm text-slate-500 mb-4">
          Choose which modules and features are available for your u3a.
          Turning off a feature hides it from all users — existing data is preserved.
        </p>

        {loading && <p className="text-center text-slate-500 py-8">Loading...</p>}

        {!loading && (
          <form onSubmit={handleSave} noValidate className="space-y-4">

            {success && (
              <p className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
                Feature configuration saved.
              </p>
            )}

            {error && (
              <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm text-center mb-4">
                {error}
              </p>
            )}

            {SECTIONS.map((section) => (
              <FeatureSection
                key={section.title}
                section={section}
                config={config}
                isSysAdmin={false}
                onChange={handleChange}
                onConfirmMasterOff={handleConfirmMasterOff}
              />
            ))}

            {canChange && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            )}

            {!canChange && (
              <p className="text-sm text-slate-500 italic text-right">
                You do not have permission to change feature configuration.
              </p>
            )}

            {/* Confirmation dialog for turning off a master module */}
            {confirmOff && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg shadow-xl max-w-sm mx-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Turn off {confirmOff.title}?
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    This will hide all {confirmOff.title} features from users.
                    Existing data is preserved and will reappear if you turn it back on.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmOff(null)}
                      className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900 border border-slate-300 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleChange(confirmOff.key, false); setConfirmOff(null); }}
                      className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Turn off
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
