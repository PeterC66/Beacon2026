// beacon2/frontend/src/pages/settings/CustomFields.jsx
// Configuration page for custom field labels (doc 8.7).

import { useState, useEffect } from 'react';
import { customFields as api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls   = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';

export default function CustomFields() {
  const { can, tenant } = useAuth();
  const [labels, setLabels]   = useState({ label1: '', label2: '', label3: '', label4: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    api.get()
      .then((data) => setLabels(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await api.update(labels);
      setLabels(data);
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  const canChange = can('custom_fields', 'change');
  const navLinks  = [{ label: 'Home', to: '/' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-2">Custom Fields</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          Define up to 4 free-form text fields that appear on every Member Record.
          Leave a label blank to hide that field.
        </p>

        {loading && <p className="text-center text-slate-400">Loading…</p>}

        {error && (
          <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm mb-4">{error}</p>
        )}

        {saved && (
          <p className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm mb-4 text-center font-medium">
            Custom field labels saved.
          </p>
        )}

        {!loading && (
          <form onSubmit={handleSave} className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
            {[1, 2, 3, 4].map((n) => {
              const key = `label${n}`;
              return (
                <div key={n}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Custom field {n} label
                  </label>
                  <input
                    type="text"
                    value={labels[key]}
                    onChange={(e) => { setSaved(false); setLabels({ ...labels, [key]: e.target.value }); }}
                    disabled={!canChange}
                    placeholder="(not used)"
                    maxLength={60}
                    className={inputCls}
                  />
                </div>
              );
            })}

            {canChange && (
              <div className="pt-2">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
