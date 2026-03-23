// beacon2/frontend/src/pages/membership/MemberClassEditor.jsx

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memberClasses as api, settings as settingsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

const BLANK = {
  name: '', current: true, explanation: '',
  isJoint: false, isAssociate: false, showOnline: false,
  fee: '', giftAidFee: '',
};

// Month names: indices 1-12 = Jan-Dec, 13 = Renewals
const MONTH_LABELS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December', 'Renewals',
];

/** Build a blank 13-row monthly fees array */
function blankMonthlyFees() {
  return Array.from({ length: 13 }, (_, i) => ({
    monthIndex: i + 1,
    fee: '',
    giftAidFee: '',
  }));
}

export default function MemberClassEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, tenant } = useAuth();
  const isNew = !id || id === 'new';

  const { markDirty, markClean } = useUnsavedChanges();
  const savedTimer = useRef(null);

  const [form,          setForm]          = useState(BLANK);
  const [locked,        setLocked]        = useState(false);
  const [loading,       setLoading]       = useState(!isNew);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [savingFees,    setSavingFees]    = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState(null);
  const [feesSaved,     setFeesSaved]     = useState(false);

  // System fee variation setting
  const [feeVariation,  setFeeVariation]  = useState('same_all_year');
  const [giftAidEnabled, setGiftAidEnabled] = useState(false);

  // Monthly fees (13 rows)
  const [monthlyFees,   setMonthlyFees]   = useState(blankMonthlyFees());
  const [autoProp,      setAutoProp]      = useState(false);

  useEffect(() => {
    settingsApi.get()
      .then((s) => {
        setFeeVariation(s.fee_variation ?? 'same_all_year');
        setGiftAidEnabled(s.gift_aid_enabled ?? false);
      })
      .catch(() => {});
  }, []);

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

    api.getMonthlyFees(id)
      .then((rows) => {
        if (rows.length > 0) {
          const filled = blankMonthlyFees().map((blank) => {
            const row = rows.find((r) => r.month_index === blank.monthIndex);
            return row
              ? { ...blank, fee: row.fee != null ? String(row.fee) : '', giftAidFee: row.gift_aid_fee != null ? String(row.gift_aid_fee) : '' }
              : blank;
          });
          setMonthlyFees(filled);
        }
      })
      .catch(() => {});
  }, [id]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
  }

  function setMonthFee(monthIndex, field, value) {
    markDirty();
    setMonthlyFees((prev) => {
      const next = prev.map((r) => r.monthIndex === monthIndex ? { ...r, [field]: value } : r);
      // Auto-propagate to subsequent months if enabled
      if (autoProp && value !== '') {
        const startIdx = monthIndex - 1; // 0-based position
        return next.map((r, i) => i >= startIdx ? { ...r, [field]: value } : r);
      }
      return next;
    });
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
      markClean();
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => navigate('/membership/classes'), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFees(e) {
    e.preventDefault();
    setSavingFees(true);
    setError(null);
    setFeesSaved(false);
    try {
      const fees = monthlyFees.map((r) => ({
        monthIndex:  r.monthIndex,
        fee:         r.fee !== '' ? Number(r.fee) : null,
        giftAidFee:  r.giftAidFee !== '' ? Number(r.giftAidFee) : null,
      }));
      await api.saveMonthlyFees(id, { fees });
      markClean();
      setFeesSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFees(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete membership class "${form.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(id);
      markClean();
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

  const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

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

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <h1 className="text-xl font-bold text-center">
          {isNew ? 'Add Membership Class' : 'Edit Membership Class'}
        </h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* ── Class Record form ───────────────────────────────────────── */}
        <form onSubmit={handleSave} className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              maxLength={100}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">Keep the name short if membership cards are printed (avoids overlap with barcode).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Explanation <span className="text-slate-400 font-normal">(shown to members joining online)</span>
            </label>
            <textarea
              name="explanation"
              value={form.explanation}
              onChange={(e) => set('explanation', e.target.value)}
              rows={3}
              className={inputCls}
            />
          </div>

          {/* Fee fields — only shown when fee_variation = 'same_all_year' */}
          {feeVariation === 'same_all_year' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fee per person (£)</label>
                <input
                  type="number" min="0" step="0.01"
                  name="fee"
                  value={form.fee}
                  onChange={(e) => set('fee', e.target.value)}
                  className="w-40 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {giftAidEnabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gift Aid eligible (£)</label>
                  <input
                    type="number" min="0" step="0.01"
                    name="giftAidFee"
                    value={form.giftAidFee}
                    onChange={(e) => set('giftAidFee', e.target.value)}
                    className="w-40 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Must be ≤ fee per person.</p>
                </div>
              )}
            </div>
          )}

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

          {saved && (
            <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 text-center">
              ✓ Saved successfully.
            </p>
          )}

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

        {/* ── Monthly fees panel — only when fee_variation = 'varies_by_month' and editing ── */}
        {!isNew && feeVariation === 'varies_by_month' && (
          <form onSubmit={handleSaveFees} className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Varying Membership Fees
              </h2>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={autoProp}
                  onChange={(e) => setAutoProp(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Auto-propagate
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Enter fees left to right. If Auto-propagate is ticked, the value you type will be
              copied automatically to all subsequent months.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-max text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">Month</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">Fee per person (£)</th>
                    {giftAidEnabled && (
                      <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">Gift Aid eligible (£)</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {monthlyFees.map((row, i) => (
                    <tr key={row.monthIndex} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-3 py-1.5 whitespace-nowrap font-medium text-slate-700">
                        {MONTH_LABELS[row.monthIndex]}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number" min="0" step="0.01"
                          name={`fee_${row.monthIndex}`}
                          value={row.fee}
                          onChange={(e) => setMonthFee(row.monthIndex, 'fee', e.target.value)}
                          className="w-28 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      {giftAidEnabled && (
                        <td className="px-3 py-1.5">
                          <input
                            type="number" min="0" step="0.01"
                            name={`giftAidFee_${row.monthIndex}`}
                            value={row.giftAidFee}
                            onChange={(e) => setMonthFee(row.monthIndex, 'giftAidFee', e.target.value)}
                            className="w-28 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={savingFees}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
              >
                {savingFees ? 'Saving…' : 'Save Fees'}
              </button>
              {feesSaved && <span className="text-sm text-green-600 font-medium">Fees saved.</span>}
            </div>
          </form>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
