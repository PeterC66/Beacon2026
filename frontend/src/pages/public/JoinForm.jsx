// beacon2/frontend/src/pages/public/JoinForm.jsx
// Public-facing online joining form for new members.
// No authentication required. Tenant resolved from URL slug.

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';

const UK_POSTCODE_RE = /^(GIR\s?0AA|[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

export default function JoinForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    classId: '', title: '', forenames: '', surname: '',
    email: '', mobile: '',
    houseNo: '', street: '', town: '', county: '', postcode: '', telephone: '',
    giftAid: false,
  });

  useEffect(() => {
    publicApi.getJoinConfig(slug)
      .then((cfg) => {
        setConfig(cfg);
        setForm((f) => ({
          ...f,
          town: cfg.defaultTown || '',
          county: cfg.defaultCounty || '',
          classId: cfg.classes.length === 1 ? cfg.classes[0].id : '',
        }));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [slug]);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.classId) errs.classId = 'Please select a membership class.';
    if (!form.forenames.trim()) errs.forenames = 'First name is required.';
    if (!form.surname.trim()) errs.surname = 'Surname is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Please enter a valid email address.';
    if (!form.postcode.trim()) errs.postcode = 'Postcode is required.';
    else if (!UK_POSTCODE_RE.test(form.postcode.trim())) errs.postcode = 'Please enter a valid UK postcode.';
    if (config?.giftAidEnabled && form.giftAid && !form.title.trim()) {
      errs.title = 'Title is required for Gift Aid claims (HMRC requirement).';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setError('');
    try {
      const result = await publicApi.submitJoin(slug, {
        classId: form.classId,
        title: form.title || undefined,
        forenames: form.forenames.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || undefined,
        address: {
          houseNo: form.houseNo.trim() || undefined,
          street: form.street.trim() || undefined,
          town: form.town.trim() || undefined,
          county: form.county.trim() || undefined,
          postcode: form.postcode.trim(),
          telephone: form.telephone.trim() || undefined,
        },
        giftAid: form.giftAid,
      });

      // Store result for the completion page and redirect to PayPal (or stub)
      sessionStorage.setItem('joinResult', JSON.stringify(result));
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        navigate(`/public/${slug}/join-complete`);
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-red-700 mb-2">Online Joining Unavailable</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <p className="text-sm text-slate-500 mt-4">
            Already a member?{' '}
            <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline">
              Sign in to the Members Portal
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const selectedClass = config?.classes.find((c) => c.id === form.classId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-xl font-bold text-center mb-1">Join {config?.u3aName}</h1>
          <p className="text-sm text-slate-600 text-center mb-6">Online membership application</p>

          <p className="text-sm text-slate-500 text-center mb-4">
            Already a member?{' '}
            <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline">
              Sign in to the Members Portal
            </Link>
          </p>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Membership class */}
            <fieldset className="mb-6">
              <legend className="text-sm font-bold text-slate-700 mb-2">Membership Type</legend>
              <select
                value={form.classId}
                onChange={(e) => handleChange('classId', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select membership type —</option>
                {config?.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.fee != null ? ` — £${Number(c.fee).toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.classId && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.classId}</p>}
              {selectedClass?.explanation && (
                <p className="text-xs text-slate-500 mt-1">{selectedClass.explanation}</p>
              )}
            </fieldset>

            {/* Personal details */}
            <fieldset className="mb-6">
              <legend className="text-sm font-bold text-slate-700 mb-2">Your Details</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Mr, Mrs, Ms, Dr..."
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.title && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First name *</label>
                  <input
                    type="text"
                    value={form.forenames}
                    onChange={(e) => handleChange('forenames', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.forenames && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.forenames}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Surname *</label>
                  <input
                    type="text"
                    value={form.surname}
                    onChange={(e) => handleChange('surname', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.surname && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.surname}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.email && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => handleChange('mobile', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Address */}
            <fieldset className="mb-6">
              <legend className="text-sm font-bold text-slate-700 mb-2">Address</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">House no / name</label>
                  <input
                    type="text"
                    value={form.houseNo}
                    onChange={(e) => handleChange('houseNo', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Street</label>
                  <input
                    type="text"
                    value={form.street}
                    onChange={(e) => handleChange('street', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Town</label>
                  <input
                    type="text"
                    value={form.town}
                    onChange={(e) => handleChange('town', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">County</label>
                  <input
                    type="text"
                    value={form.county}
                    onChange={(e) => handleChange('county', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Postcode *</label>
                  <input
                    type="text"
                    value={form.postcode}
                    onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.postcode && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.postcode}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telephone</label>
                  <input
                    type="tel"
                    value={form.telephone}
                    onChange={(e) => handleChange('telephone', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Gift Aid */}
            {config?.giftAidEnabled && (
              <fieldset className="mb-6">
                <legend className="text-sm font-bold text-slate-700 mb-2">Gift Aid</legend>
                <p className="text-xs text-slate-500 mb-2">
                  If you are a UK taxpayer, your u3a can claim Gift Aid on your subscription
                  at no extra cost to you. For Gift Aid to be processed, you must provide a Title.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.giftAid}
                    onChange={(e) => handleChange('giftAid', e.target.checked)}
                  />
                  I would like my u3a to claim Gift Aid on my subscription
                </label>
              </fieldset>
            )}

            {/* Privacy policy */}
            {config?.privacyPolicyUrl && (
              <p className="text-xs text-slate-500 mb-4">
                By submitting this form you agree to our{' '}
                <a href={config.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  Privacy Policy
                </a>.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-3 text-sm font-medium transition-colors"
            >
              {submitting ? 'Processing...' : `Make Payment${selectedClass?.fee ? ` — £${Number(selectedClass.fee).toFixed(2)}` : ''}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
