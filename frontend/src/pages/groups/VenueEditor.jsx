// beacon2/frontend/src/pages/groups/VenueEditor.jsx
// Add / Edit a group venue (5.7)

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { venues as venuesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

const EMPTY = {
  name: '', address1: '', address2: '', town: '', county: '', postcode: '',
  telephone: '', email: '', website: '', notes: '',
  privateAddress: false, accessible: false,
};

export default function VenueEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const isNew = id === undefined;

  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  const canChange = isNew ? can('group_venues', 'create') : can('group_venues', 'change');
  const canDelete = !isNew && can('group_venues', 'delete');

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    venuesApi.get(id)
      .then((v) => setForm({
        name:           v.name ?? '',
        address1:       v.address1 ?? '',
        address2:       v.address2 ?? '',
        town:           v.town ?? '',
        county:         v.county ?? '',
        postcode:       v.postcode ?? '',
        telephone:      v.telephone ?? '',
        email:          v.email ?? '',
        website:        v.website ?? '',
        notes:          v.notes ?? '',
        privateAddress: v.private_address ?? false,
        accessible:     v.accessible ?? false,
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function set(field, value) {
    markDirty();
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name:           form.name,
        address1:       form.address1 || null,
        address2:       form.address2 || null,
        town:           form.town || null,
        county:         form.county || null,
        postcode:       form.postcode || null,
        telephone:      form.telephone || null,
        email:          form.email || null,
        website:        form.website || null,
        notes:          form.notes || null,
        privateAddress: form.privateAddress,
        accessible:     form.accessible,
      };
      if (isNew) {
        await venuesApi.create(payload);
      } else {
        await venuesApi.update(id, payload);
      }
      markClean();
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => navigate('/venues'), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete venue "${form.name}"? This cannot be undone.`)) return;
    try {
      await venuesApi.delete(id);
      markClean();
      navigate('/venues');
    } catch (err) {
      setError(err.message);
    }
  }

  const navLinks = [
    { label: 'Home',   to: '/' },
    { label: 'Groups', to: '/groups' },
    { label: 'Venues', to: '/venues' },
    ...(can('group_venues', 'create') ? [{ label: 'Add new venue', to: '/venues/new' }] : []),
  ];

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  if (loading) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <p className="text-center text-slate-500 py-8">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">
          {isNew ? 'Add New Venue' : 'Venue Record'}
        </h1>

        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          {saved && (
            <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 text-center mb-3">
              ✓ Saved successfully.
            </p>
          )}

          <form onSubmit={handleSave} noValidate className="space-y-4">

            {/* Venue name */}
            <div>
              <label className={labelCls}>Venue <RequiredMark /></label>
              <input name="name" className={`${inputCls} w-full`} required value={form.name}
                onChange={(e) => set('name', e.target.value)} disabled={!canChange} />
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>Address line 1</label>
              <input name="address1" className={`${inputCls} w-full`} value={form.address1}
                onChange={(e) => set('address1', e.target.value)} disabled={!canChange} />
            </div>
            <div>
              <label className={labelCls}>Address line 2</label>
              <input name="address2" className={`${inputCls} w-full`} value={form.address2}
                onChange={(e) => set('address2', e.target.value)} disabled={!canChange} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Town</label>
                <input name="town" className={`${inputCls} w-full`} value={form.town}
                  onChange={(e) => set('town', e.target.value)} disabled={!canChange} />
              </div>
              <div>
                <label className={labelCls}>County</label>
                <input name="county" className={`${inputCls} w-full`} value={form.county}
                  onChange={(e) => set('county', e.target.value)} disabled={!canChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Postcode</label>
                <input name="postcode" className={`${inputCls} w-full`} value={form.postcode}
                  onChange={(e) => set('postcode', e.target.value)} disabled={!canChange} />
              </div>
              <div>
                <label className={labelCls}>Telephone</label>
                <input name="telephone" className={`${inputCls} w-full`} type="tel" value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)} disabled={!canChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email</label>
                <input name="email" className={`${inputCls} w-full`} type="email" value={form.email}
                  onChange={(e) => set('email', e.target.value)} disabled={!canChange} />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input name="website" className={`${inputCls} w-full`} type="url" value={form.website}
                  placeholder="https://…"
                  onChange={(e) => set('website', e.target.value)} disabled={!canChange} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes</label>
              <textarea name="notes" rows={3} className={`${inputCls} w-full resize-y`} value={form.notes}
                onChange={(e) => set('notes', e.target.value)} disabled={!canChange} />
            </div>

            {/* Checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className={cbCls} checked={form.privateAddress}
                  onChange={(e) => set('privateAddress', e.target.checked)} disabled={!canChange} />
                Private address (do not display publicly)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className={cbCls} checked={form.accessible}
                  onChange={(e) => set('accessible', e.target.checked)} disabled={!canChange} />
                Accessible (wheelchair accessible)
              </label>
            </div>

            {/* External links (view mode) */}
            {!isNew && form.postcode && (
              <div className="flex gap-3 text-sm pt-1">
                <a
                  href={`https://streetmap.co.uk/postcode/${encodeURIComponent(form.postcode.replace(/\s/g, ''))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Streetmap
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(form.postcode)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Google Maps
                </a>
              </div>
            )}

            {/* Buttons */}
            {canChange && (
              <div className="flex gap-3 items-center pt-2">
                <button type="submit" disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                  {saving ? 'Saving…' : 'Save Record'}
                </button>
                {canDelete && (
                  <button type="button" onClick={handleDelete}
                    className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm">
                    Delete
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
