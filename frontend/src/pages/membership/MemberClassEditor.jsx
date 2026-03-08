// beacon2/frontend/src/pages/membership/MemberClassEditor.jsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memberClasses as api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const BLANK = {
  name: '', current: true, explanation: '',
  isJoint: false, isAssociate: false, showOnline: false,
  fee: '', giftAidFee: '',
};

export default function MemberClassEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, tenant } = useAuth();
  const isNew = !id || id === 'new';

  const [form,    setForm]    = useState(BLANK);
  const [locked,  setLocked]  = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (isNew) return;
    api.get(id)
      .then((mc) => {
        setForm({
          name:        mc.name,
          current:     mc.current,
          explanation: mc.explanation ?? '',
          isJoint:     mc.is_joint,
          isAssociate: mc.is_associate,
          showOnline:  mc.show_online,
          fee:         mc.fee != null ? String(mc.fee) : '',
          giftAidFee:  mc.gift_aid_fee != null ? String(mc.gift_aid_fee) : '',
        });
        setLocked(mc.locked);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name:        form.name,
        current:     form.current,
        explanation: form.explanation || undefined,
        isJoint:     form.isJoint,
        isAssociate: form.isAssociate,
        showOnline:  form.showOnline,
        fee:         form.fee !== '' ? Number(form.fee) : undefined,
        giftAidFee:  form.giftAidFee !== '' ? Number(form.giftAidFee) : undefined,
      };
      if (isNew) {
        await api.create(payload);
      } else {
        await api.update(id, payload);
      }
      navigate('/membership/classes');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete membership class "${form.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(id);
      navigate('/membership/classes');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Membership Classes', to: '/membership/classes' },
  ];

  if (loading) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <p className="text-center text-slate-500 mt-8">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">
          {isNew ? 'Add Membership Class' : 'Edit Membership Class'}
        </h1>

        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleSave} className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              maxLength={100}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Explanation <span className="text-slate-400 font-normal">(shown to online joiners)</span>
            </label>
            <textarea
              value={form.explanation}
              onChange={(e) => set('explanation', e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fee per person (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.fee}
              onChange={(e) => set('fee', e.target.value)}
              className="w-40 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gift Aid eligible (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.giftAidFee}
              onChange={(e) => set('giftAidFee', e.target.value)}
              className="w-40 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <fieldset className="space-y-2 pt-1">
            <legend className="text-sm font-medium text-slate-700 mb-1">Options</legend>

            {[
              ['current',     'Current (may be used for new memberships)'],
              ['isJoint',     '1 of 2 people at same address (joint / family membership)'],
              ['isAssociate', 'Full member of another u3a (associate)'],
              ['showOnline',  'Show to members joining online'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={(e) => set(field, e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save Record'}
            </button>

            {!isNew && !locked && can('member_classes', 'delete') && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>

          {locked && (
            <p className="text-xs text-slate-400 italic">
              This class is locked and cannot be deleted.
            </p>
          )}
        </form>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
