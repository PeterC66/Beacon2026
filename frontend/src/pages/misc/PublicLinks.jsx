// beacon2/frontend/src/pages/misc/PublicLinks.jsx
// Admin page showing public URLs and online joining configuration.

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { publicLinks as api } from '../../lib/api.js';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

export default function PublicLinks() {
  const { tenant, can } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ onlineJoiningEnabled: false, privacyPolicyUrl: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  useEffect(() => {
    api.get().then((d) => {
      setData(d);
      setForm({ onlineJoiningEnabled: d.onlineJoiningEnabled, privacyPolicyUrl: d.privacyPolicyUrl || '' });
    }).catch((e) => setError(e.message));
  }, []);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
  }

  async function handleSave() {
    try {
      setError('');
      const updated = await api.update(form);
      setData((prev) => ({ ...prev, ...updated }));
      markClean();
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    }
  }

  const canChange = can('public_links', 'change');
  const frontendBase = window.location.origin;
  const slug = data?.tenantSlug || '';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ to: '/', label: 'Home' }, { label: 'Public Links' }]} />

      <div className="max-w-3xl mx-auto px-4 mt-4">
        <h1 className="text-xl font-bold mb-4">Public Links</h1>

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

        {/* Member Services URLs */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="font-bold text-sm mb-3">Member Services</h2>
          <p className="text-sm text-slate-600 mb-3">
            Copy these URLs to create links on your u3a website for online membership applications
            and the Members Portal.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New membership application
              </label>
              <input
                type="text"
                readOnly
                name="joinUrl"
                value={slug ? `${frontendBase}/public/${slug}/join` : ''}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50 font-mono"
                onClick={(e) => e.target.select()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Members Portal
              </label>
              <input
                type="text"
                readOnly
                name="portalUrl"
                value={slug ? `${frontendBase}/public/${slug}/portal` : ''}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50 font-mono"
                onClick={(e) => e.target.select()}
              />
            </div>
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
