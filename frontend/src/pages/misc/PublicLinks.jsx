// beacon2/frontend/src/pages/misc/PublicLinks.jsx
// Admin page showing public URLs and online joining configuration (doc 9.4).
// Sections: (a) Member Services, (b) Public Information,
// (c) Configure Members Portal, (d) Configure Group Information,
// (e) Configure Calendar.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { publicLinks as api } from '../../lib/api.js';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

// ── Render helpers (plain functions, not components) ─────────────────────

function renderCopyableUrl(label, value, name) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        readOnly
        name={name}
        value={value}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50 font-mono"
        onClick={(e) => e.target.select()}
      />
    </div>
  );
}

function renderToggleGrid(title, rows, config, audience1, audience2, onChange, disabled) {
  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
      <h2 className="font-bold text-sm mb-3">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 pr-4 font-medium text-slate-700">Show:</th>
            <th className="text-center py-2 px-4 font-medium text-slate-700">{audience1}</th>
            <th className="text-center py-2 px-4 font-medium text-slate-700">{audience2}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, note }) => (
            <tr key={key} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-700">
                {label}
                {note && <span className="block text-xs text-slate-500 mt-0.5">{note}</span>}
              </td>
              <td className="text-center py-2 px-4">
                <input
                  type="checkbox"
                  checked={config[key]?.members ?? false}
                  onChange={(e) => onChange(key, 'members', e.target.checked)}
                  disabled={disabled}
                  className="rounded"
                />
              </td>
              <td className="text-center py-2 px-4">
                <input
                  type="checkbox"
                  checked={config[key]?.public ?? false}
                  onChange={(e) => onChange(key, 'public', e.target.checked)}
                  disabled={disabled}
                  className="rounded"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export default function PublicLinks() {
  const { tenant, can } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    onlineJoiningEnabled: false,
    privacyPolicyUrl: '',
    portalConfig: {},
    groupInfoConfig: {},
    calendarConfig: {},
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  useEffect(() => {
    api.get().then((d) => {
      setData(d);
      setForm({
        onlineJoiningEnabled: d.onlineJoiningEnabled,
        privacyPolicyUrl: d.privacyPolicyUrl || '',
        portalConfig: d.portalConfig || {},
        groupInfoConfig: d.groupInfoConfig || {},
        calendarConfig: d.calendarConfig || {},
      });
    }).catch((e) => setError(e.message));
  }, []);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
  }

  function handlePortalToggle(key, checked) {
    setForm((prev) => ({
      ...prev,
      portalConfig: { ...prev.portalConfig, [key]: checked },
    }));
    markDirty();
  }

  function handleGridToggle(configField, rowKey, audience, checked) {
    setForm((prev) => ({
      ...prev,
      [configField]: {
        ...prev[configField],
        [rowKey]: { ...(prev[configField][rowKey] || {}), [audience]: checked },
      },
    }));
    markDirty();
  }

  async function handleSave() {
    try {
      setError('');
      const updated = await api.update(form);
      setData((prev) => ({ ...prev, ...updated }));
      markClean();
      setSaved(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    }
  }

  const canChange = can('public_links', 'change');
  const frontendBase = window.location.origin;
  const slug = data?.tenantSlug || '';

  const GROUP_INFO_ROWS = [
    { key: 'status',    label: 'Status' },
    { key: 'venue',     label: 'Venue' },
    { key: 'contact',   label: 'Contact' },
    { key: 'detail',    label: 'Detail' },
    { key: 'enquiries', label: 'Enquiries' },
    { key: 'joinGroup', label: 'Join Group', note: 'Individual groups must enable members to join on-line' },
  ];

  const CALENDAR_ROWS = [
    { key: 'venue',     label: 'Venue' },
    { key: 'topic',     label: 'Topic' },
    { key: 'enquiries', label: 'Enquiries' },
    { key: 'detail',    label: 'Detail' },
    { key: 'download',  label: 'Download' },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ to: '/', label: 'Home' }, { label: 'Public Links' }]} />

      <div className="max-w-3xl mx-auto px-4 mt-4">
        <h1 className="text-xl font-bold mb-4">Public Links</h1>

        <p className="text-sm text-slate-600 mb-4">
          Set the parameters for your public links. These may be used in your u3a website
          to provide access to services and information.
        </p>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          The Trust states that a Privacy Policy is essential and is part of the Beacon Terms and Conditions.
          Both new people joining your u3a and existing members renewing must be reminded of this.
        </p>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
            Settings saved successfully.
          </div>
        )}

        {/* (a) Member Services */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="font-bold text-sm mb-3">Member Services</h2>
          <p className="text-sm text-slate-600 mb-3">
            Copy these URLs to create links on your u3a website for online membership applications
            and the Members Portal. When copying a URL, make sure the entire link is included.
          </p>
          <div className="space-y-3">
            {renderCopyableUrl('New membership application', slug ? `${frontendBase}/public/${slug}/join` : '', 'joinUrl')}
            {renderCopyableUrl('Members Portal', slug ? `${frontendBase}/public/${slug}/portal` : '', 'portalUrl')}
          </div>
        </div>

        {/* (b) Public Information */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="font-bold text-sm mb-3">Public Information</h2>
          <p className="text-sm text-slate-600 mb-3">
            Copy these URLs to create links to the public groups list and calendar.
            Adding <code className="bg-slate-100 px-1 rounded text-xs">&amp;hdr=0</code> to the URL suppresses the page header.
          </p>
          <div className="space-y-3">
            {renderCopyableUrl('Groups list', slug ? `${frontendBase}/public/${slug}/groups` : '', 'groupsUrl')}
            {renderCopyableUrl('Calendar', slug ? `${frontendBase}/public/${slug}/calendar` : '', 'calendarUrl')}
          </div>
        </div>

        {/* Online Joining Configuration */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="font-bold text-sm mb-3">Online Joining</h2>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.onlineJoiningEnabled}
                onChange={(e) => handleChange('onlineJoiningEnabled', e.target.checked)}
                disabled={!canChange}
              />
              Enable online membership applications
            </label>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Privacy policy URL
              </label>
              <input
                type="url"
                name="privacyPolicyUrl"
                value={form.privacyPolicyUrl}
                onChange={(e) => handleChange('privacyPolicyUrl', e.target.value)}
                disabled={!canChange}
                placeholder="https://your-u3a.org.uk/privacy"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Shown to new members on the joining form. Required by the Trust.
              </p>
            </div>

            {data?.paypalEmail ? (
              <p className="text-sm text-green-700">
                PayPal account: {data.paypalEmail}
              </p>
            ) : (
              <p className="text-sm text-amber-600">
                No PayPal account configured. Set it in System Settings to enable online payments.
              </p>
            )}
          </div>
        </div>

        {/* (c) Configure Members Portal */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="font-bold text-sm mb-3">Configure Members Portal</h2>
          <p className="text-sm text-slate-600 mb-3">
            Tick boxes control the options available to members when they log in to the Members Portal.
          </p>
          <div className="space-y-2">
            {[
              { key: 'renewals',        label: 'Membership renewals' },
              { key: 'groups',          label: 'Groups' },
              { key: 'calendar',        label: 'Calendar' },
              { key: 'personalDetails', label: 'Change Personal Details' },
              { key: 'replacementCard', label: 'Email Replacement membership card' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.portalConfig[key] ?? false}
                  onChange={(e) => handlePortalToggle(key, e.target.checked)}
                  disabled={!canChange}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* (d) Configure Group Information */}
        {renderToggleGrid(
          'Configure Group Information',
          GROUP_INFO_ROWS,
          form.groupInfoConfig,
          'to members', 'to public',
          (rowKey, audience, checked) => handleGridToggle('groupInfoConfig', rowKey, audience, checked),
          !canChange,
        )}

        {/* (e) Configure Calendar */}
        {renderToggleGrid(
          'Configure Calendar',
          CALENDAR_ROWS,
          form.calendarConfig,
          'to members', 'to public',
          (rowKey, audience, checked) => handleGridToggle('calendarConfig', rowKey, audience, checked),
          !canChange,
        )}

        {canChange && (
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}
