// beacon2/frontend/src/pages/settings/SystemSettings.jsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import { settings as settingsApi } from '../../lib/api.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { SETTINGS_PAYMENT_METHODS as PAYMENT_METHODS } from '../../lib/constants.js';

function fmtTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const yr  = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${mon} ${yr} ${hh}:${mm}`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULTS = {
  card_colour:               '#0066cc',
  email_cards:               false,
  public_phone:              '',
  public_email:              '',
  home_page:                 '',
  online_join_email:         '',
  online_renew_email:        '',
  fee_variation:             'same_all_year',
  extended_membership_month: '',
  advance_renewals_weeks:    4,
  grace_lapse_weeks:         4,
  deletion_years:            7,
  default_payment_method:    'Cheque',
  gift_aid_online_renewals:  false,
  default_town:              '',
  default_county:            '',
  default_std_code:          '',
  paypal_email:              '',
  paypal_cancel_url:         '',
  shared_address_warning:    false,
  year_start_month:          1,
  year_start_day:            1,
};

function toForm(s) {
  return {
    card_colour:               s.card_colour               ?? DEFAULTS.card_colour,
    email_cards:               s.email_cards               ?? DEFAULTS.email_cards,
    public_phone:              s.public_phone              ?? '',
    public_email:              s.public_email              ?? '',
    home_page:                 s.home_page                 ?? '',
    online_join_email:         s.online_join_email         ?? '',
    online_renew_email:        s.online_renew_email        ?? '',
    fee_variation:             s.fee_variation             ?? DEFAULTS.fee_variation,
    extended_membership_month: s.extended_membership_month ?? '',
    advance_renewals_weeks:    s.advance_renewals_weeks    ?? DEFAULTS.advance_renewals_weeks,
    grace_lapse_weeks:         s.grace_lapse_weeks         ?? DEFAULTS.grace_lapse_weeks,
    deletion_years:            s.deletion_years            ?? DEFAULTS.deletion_years,
    default_payment_method:    s.default_payment_method    ?? DEFAULTS.default_payment_method,
    gift_aid_online_renewals:  s.gift_aid_online_renewals  ?? DEFAULTS.gift_aid_online_renewals,
    default_town:              s.default_town              ?? '',
    default_county:            s.default_county            ?? '',
    default_std_code:          s.default_std_code          ?? '',
    paypal_email:              s.paypal_email              ?? '',
    paypal_cancel_url:         s.paypal_cancel_url         ?? '',
    shared_address_warning:    s.shared_address_warning    ?? DEFAULTS.shared_address_warning,
    year_start_month:          s.year_start_month          ?? DEFAULTS.year_start_month,
    year_start_day:            s.year_start_day            ?? DEFAULTS.year_start_day,
  };
}

function toPayload(f) {
  return {
    cardColour:               f.card_colour,
    emailCards:               f.email_cards,
    publicPhone:              f.public_phone   || null,
    publicEmail:              f.public_email   || null,
    homePage:                 f.home_page      || null,
    onlineJoinEmail:          f.online_join_email  || null,
    onlineRenewEmail:         f.online_renew_email || null,
    feeVariation:             f.fee_variation,
    extendedMembershipMonth:  f.extended_membership_month !== '' ? Number(f.extended_membership_month) : null,
    advanceRenewalsWeeks:     Number(f.advance_renewals_weeks),
    graceLapseWeeks:          Number(f.grace_lapse_weeks),
    deletionYears:            Number(f.deletion_years),
    defaultPaymentMethod:     f.default_payment_method,
    giftAidOnlineRenewals:    f.gift_aid_online_renewals,
    defaultTown:              f.default_town    || null,
    defaultCounty:            f.default_county  || null,
    defaultStdCode:           f.default_std_code || null,
    paypalEmail:              f.paypal_email    || null,
    paypalCancelUrl:          f.paypal_cancel_url || null,
    sharedAddressWarning:     f.shared_address_warning,
    yearStartMonth:           Number(f.year_start_month),
    yearStartDay:             Number(f.year_start_day),
  };
}

// ─── Shared input styles ──────────────────────────────────────────────────
const INPUT  = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
const SELECT = INPUT;
const LABEL  = 'block text-sm font-medium text-slate-700 mb-1';

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function CheckField({ label, name, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        checked={value}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-3">
      {children}
    </h2>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function SystemSettings() {
  const { tenant, can } = useAuth();
  const { markDirty, markClean } = useUnsavedChanges();

  const [form,      setForm]      = useState(toForm({}));
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);
  const [success,   setSuccess]   = useState(false);

  useEffect(() => {
    settingsApi.get()
      .then((s) => { setForm(toForm(s)); setUpdatedAt(s.updated_at ?? null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setSuccess(false);
    markDirty();
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await settingsApi.update(toPayload(form));
      setForm(toForm(updated));
      setUpdatedAt(updated.updated_at ?? null);
      markClean();
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canChange = can('settings', 'change');

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ to: '/', label: 'Home' }, { label: 'System Settings' }]} />

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">System Settings</h1>
        {updatedAt && (
          <p className="text-xs text-slate-500 mb-4">
            Settings last changed {fmtTimestamp(updatedAt)}
          </p>
        )}

        {loading && <p className="text-slate-500 text-sm">Loading…</p>}

        {!loading && (
          <form onSubmit={handleSave} noValidate className="space-y-8">

            {/* ── Membership Cards ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <SectionHeading>Membership Cards</SectionHeading>
              <Field label="Membership card colour" htmlFor="settings-card-colour">
                <div className="flex items-center gap-3">
                  <input
                    id="settings-card-colour"
                    type="color"
                    name="card_colour"
                    value={form.card_colour}
                    onChange={handleChange}
                    disabled={!canChange}
                    className="h-9 w-16 rounded border border-slate-300 cursor-pointer disabled:opacity-50"
                  />
                  <input
                    id="settings-card-colour-text"
                    type="text"
                    name="card_colour"
                    value={form.card_colour}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT + ' max-w-[120px]'}
                    placeholder="#0066cc"
                  />
                </div>
              </Field>
              <CheckField
                label="Email membership cards with confirmation emails (for online joining / renewal)"
                name="email_cards"
                value={form.email_cards}
                onChange={handleChange}
              />
            </section>

            {/* ── Contact Details ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <SectionHeading>Contact Details</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Public enquiry telephone" htmlFor="settings-public-phone">
                  <input
                    id="settings-public-phone"
                    type="tel"
                    name="public_phone"
                    value={form.public_phone}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                    placeholder="e.g. 01234 567890"
                  />
                </Field>
                <Field label="Public enquiry email" htmlFor="settings-public-email">
                  <input
                    id="settings-public-email"
                    type="email"
                    name="public_email"
                    value={form.public_email}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                    placeholder="enquiries@example.u3a.org.uk"
                  />
                </Field>
              </div>
              <Field label="u3a home page URL" htmlFor="settings-home-page">
                <input
                  id="settings-home-page"
                  type="url"
                  name="home_page"
                  value={form.home_page}
                  onChange={handleChange}
                  disabled={!canChange}
                  className={INPUT}
                  placeholder="https://www.example.u3a.org.uk"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Online new member enquiries email" htmlFor="settings-online-join-email">
                  <input
                    id="settings-online-join-email"
                    type="email"
                    name="online_join_email"
                    value={form.online_join_email}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                    placeholder="join@example.u3a.org.uk"
                  />
                </Field>
                <Field label="Online renewal enquiries email" htmlFor="settings-online-renew-email">
                  <input
                    id="settings-online-renew-email"
                    type="email"
                    name="online_renew_email"
                    value={form.online_renew_email}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                    placeholder="renew@example.u3a.org.uk"
                  />
                </Field>
              </div>
            </section>

            {/* ── Membership Year & Fees ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <SectionHeading>Membership Year &amp; Fees</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Membership year start — month" htmlFor="settings-year-start-month">
                  <select
                    id="settings-year-start-month"
                    name="year_start_month"
                    value={form.year_start_month}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={SELECT}
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Membership year start — day" htmlFor="settings-year-start-day">
                  <input
                    id="settings-year-start-day"
                    type="number"
                    name="year_start_day"
                    value={form.year_start_day}
                    onChange={handleChange}
                    disabled={!canChange}
                    min="1"
                    max="31"
                    className={INPUT}
                  />
                </Field>
              </div>
              <Field label="Membership fees" htmlFor="settings-fee-variation">
                <select
                  id="settings-fee-variation"
                  name="fee_variation"
                  value={form.fee_variation}
                  onChange={handleChange}
                  disabled={!canChange}
                  className={SELECT}
                >
                  <option value="same_all_year">Same fees all year</option>
                  <option value="varies_by_month">Fees vary by month of joining</option>
                </select>
              </Field>
              <Field label="Extended membership — month from which new memberships include the following year" htmlFor="settings-extended-membership-month">
                <select
                  id="settings-extended-membership-month"
                  name="extended_membership_month"
                  value={form.extended_membership_month}
                  onChange={handleChange}
                  disabled={!canChange}
                  className={SELECT}
                >
                  <option value="">Not enabled</option>
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Advance renewals period (weeks)" htmlFor="settings-advance-renewals-weeks">
                  <input
                    id="settings-advance-renewals-weeks"
                    type="number"
                    name="advance_renewals_weeks"
                    value={form.advance_renewals_weeks}
                    onChange={handleChange}
                    disabled={!canChange}
                    min="0"
                    max="52"
                    className={INPUT}
                  />
                </Field>
                <Field label="Grace lapse period (weeks)" htmlFor="settings-grace-lapse-weeks">
                  <input
                    id="settings-grace-lapse-weeks"
                    type="number"
                    name="grace_lapse_weeks"
                    value={form.grace_lapse_weeks}
                    onChange={handleChange}
                    disabled={!canChange}
                    min="0"
                    max="52"
                    className={INPUT}
                  />
                </Field>
                <Field label="Non-renewal deletion period (years, 2–7)" htmlFor="settings-deletion-years">
                  <input
                    id="settings-deletion-years"
                    type="number"
                    name="deletion_years"
                    value={form.deletion_years}
                    onChange={handleChange}
                    disabled={!canChange}
                    min="2"
                    max="7"
                    className={INPUT}
                  />
                </Field>
              </div>
              <Field label="Default payment method" htmlFor="settings-default-payment-method">
                <select
                  id="settings-default-payment-method"
                  name="default_payment_method"
                  value={form.default_payment_method}
                  onChange={handleChange}
                  disabled={!canChange}
                  className={SELECT}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </section>

            {/* ── Gift Aid ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-3">
              <SectionHeading>Gift Aid</SectionHeading>
              <CheckField
                label="Show Gift Aid tick boxes for online renewals"
                name="gift_aid_online_renewals"
                value={form.gift_aid_online_renewals}
                onChange={handleChange}
              />
            </section>

            {/* ── Defaults for New Members ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <SectionHeading>Defaults for New Members</SectionHeading>
              <p className="text-xs text-slate-500">
                These values are pre-filled when creating a new member record and can be overridden at that point.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Default town" htmlFor="settings-default-town">
                  <input
                    id="settings-default-town"
                    type="text"
                    name="default_town"
                    value={form.default_town}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                  />
                </Field>
                <Field label="Default county" htmlFor="settings-default-county">
                  <input
                    id="settings-default-county"
                    type="text"
                    name="default_county"
                    value={form.default_county}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                  />
                </Field>
                <Field label="Default STD code" htmlFor="settings-default-std-code">
                  <input
                    id="settings-default-std-code"
                    type="text"
                    name="default_std_code"
                    value={form.default_std_code}
                    onChange={handleChange}
                    disabled={!canChange}
                    className={INPUT}
                    placeholder="e.g. 01234"
                  />
                </Field>
              </div>
            </section>

            {/* ── Online Payments (PayPal) ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <SectionHeading>Online Payments (PayPal)</SectionHeading>
              <Field label="PayPal account email" htmlFor="settings-paypal-email">
                <input
                  id="settings-paypal-email"
                  type="email"
                  name="paypal_email"
                  value={form.paypal_email}
                  onChange={handleChange}
                  disabled={!canChange}
                  className={INPUT}
                  placeholder="paypal@example.u3a.org.uk"
                />
              </Field>
              <Field label="PayPal cancel return URL" htmlFor="settings-paypal-cancel-url">
                <input
                  id="settings-paypal-cancel-url"
                  type="url"
                  name="paypal_cancel_url"
                  value={form.paypal_cancel_url}
                  onChange={handleChange}
                  disabled={!canChange}
                  className={INPUT}
                  placeholder="https://www.example.u3a.org.uk/join"
                />
              </Field>
            </section>

            {/* ── Member Record ── */}
            <section className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 space-y-3">
              <SectionHeading>Member Record</SectionHeading>
              <CheckField
                label="Warn when saving shared addresses if member statuses or classes differ"
                name="shared_address_warning"
                value={form.shared_address_warning}
                onChange={handleChange}
              />
            </section>

            {/* ── Status / Save ── */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-4 py-2">
                Settings saved.
              </p>
            )}

            {canChange && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Update'}
                </button>
              </div>
            )}

            {!canChange && (
              <p className="text-sm text-slate-500 italic text-right">
                You do not have permission to change system settings.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
