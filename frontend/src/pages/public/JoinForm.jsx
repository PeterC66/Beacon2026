// beacon2/frontend/src/pages/public/JoinForm.jsx
// Public-facing online joining form for new members.
// No authentication required. Tenant resolved from URL slug.

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';
import RequiredMark from '../../components/RequiredMark.jsx';
import { scrollToFirstFieldError } from '../../lib/scrollToError.js';
import PortalVersion from '../../components/PortalVersion.jsx';
import { UK_POSTCODE_RE } from '../../lib/constants.js';

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
    // Joint member (second person) fields
    p2Title: '', p2Forenames: '', p2Surname: '',
    p2Email: '', p2Mobile: '',
    p2GiftAid: false,
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

  const isJoint = config?.classes.find((c) => c.id === form.classId)?.is_joint ?? false;

  function validate() {
    const errs = {};
    if (!form.classId) errs.classId = 'Please select a membership class.';
    if (!form.forenames.trim()) errs.forenames = 'First name is required.';
    if (!form.surname.trim()) errs.surname = 'Surname is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Please enter a valid email address.';
    if (!form.postcode.trim()) errs.postcode = 'Postcode is required.';
    else if (!UK_POSTCODE_RE.test(form.postcode.trim())) errs.postcode = 'Please enter a valid UK postcode.';
    if (config?.giftAidEnabled && form.giftAid) {
      if (!form.title.trim()) errs.title = 'Title is required for Gift Aid (HMRC requirement).';
      if (!form.houseNo.trim()) errs.houseNo = 'House name or number is required for Gift Aid (HMRC requirement).';
    }
    // Joint member (second person) validation
    if (isJoint) {
      if (!form.p2Forenames.trim()) errs.p2Forenames = 'Second person\'s first name is required.';
      if (!form.p2Surname.trim()) errs.p2Surname = 'Second person\'s surname is required.';
      if (config?.giftAidEnabled && form.p2GiftAid) {
        if (!form.p2Title.trim()) errs.p2Title = 'Title is required for Gift Aid (HMRC requirement).';
      }
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { scrollToFirstFieldError(Object.keys(errs)); return; }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
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
      };

      if (isJoint) {
        payload.partner2 = {
          title: form.p2Title || undefined,
          forenames: form.p2Forenames.trim(),
          surname: form.p2Surname.trim(),
          email: form.p2Email.trim() || undefined,
          mobile: form.p2Mobile.trim() || undefined,
          giftAid: form.p2GiftAid,
        };
      }

      const result = await publicApi.submitJoin(slug, payload);

      // Navigate to the pending page where the applicant can pay or get a link
      navigate(`/public/${slug}/join-pending`, {
        state: {
          memberId:         result.memberId,
          membershipNumber: result.membershipNumber,
          paymentToken:     result.paymentToken,
          redirectUrl:      result.redirectUrl,
          amount:           result.amount,
          className:        result.className,
          forenames:        form.forenames.trim(),
          surname:          form.surname.trim(),
          partner2:         result.partner2 ?? null,
        },
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <PortalVersion />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <PortalVersion />
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
  const displayFee = selectedClass?.fee != null
    ? (isJoint ? Number(selectedClass.fee) * 2 : Number(selectedClass.fee))
    : null;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-8 px-4">
      <PortalVersion />
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
                name="classId"
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
              {isJoint && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  This is a joint membership — please provide details for both people below.
                  The fee is £{displayFee?.toFixed(2)} for two members.
                </p>
              )}
            </fieldset>

            {/* Personal details */}
            <fieldset className="mb-6">
              <legend className="text-sm font-bold text-slate-700 mb-2">{isJoint ? 'First Person' : 'Your Details'}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="join-title" className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    id="join-title"
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Mr, Mrs, Ms, Dr..."
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.title && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.title}</p>}
                </div>
                <div>
                  <label htmlFor="join-forenames" className="block text-sm font-medium text-slate-700 mb-1">First name <RequiredMark /></label>
                  <input
                    id="join-forenames"
                    type="text"
                    name="forenames"
                    value={form.forenames}
                    onChange={(e) => handleChange('forenames', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.forenames && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.forenames}</p>}
                </div>
                <div>
                  <label htmlFor="join-surname" className="block text-sm font-medium text-slate-700 mb-1">Surname <RequiredMark /></label>
                  <input
                    id="join-surname"
                    type="text"
                    name="surname"
                    value={form.surname}
                    onChange={(e) => handleChange('surname', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.surname && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.surname}</p>}
                </div>
                <div>
                  <label htmlFor="join-email" className="block text-sm font-medium text-slate-700 mb-1">Email <RequiredMark /></label>
                  <input
                    id="join-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.email && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label htmlFor="join-mobile" className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    id="join-mobile"
                    type="tel"
                    name="mobile"
                    value={form.mobile}
                    onChange={(e) => handleChange('mobile', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Second person (joint membership) */}
            {isJoint && (
              <fieldset className="mb-6">
                <legend className="text-sm font-bold text-slate-700 mb-2">Second Person</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="join2-title" className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                    <input
                      id="join2-title"
                      type="text"
                      name="p2Title"
                      value={form.p2Title}
                      onChange={(e) => handleChange('p2Title', e.target.value)}
                      placeholder="Mr, Mrs, Ms, Dr..."
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {fieldErrors.p2Title && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.p2Title}</p>}
                  </div>
                  <div>
                    <label htmlFor="join2-forenames" className="block text-sm font-medium text-slate-700 mb-1">First name <RequiredMark /></label>
                    <input
                      id="join2-forenames"
                      type="text"
                      name="p2Forenames"
                      value={form.p2Forenames}
                      onChange={(e) => handleChange('p2Forenames', e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {fieldErrors.p2Forenames && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.p2Forenames}</p>}
                  </div>
                  <div>
                    <label htmlFor="join2-surname" className="block text-sm font-medium text-slate-700 mb-1">Surname <RequiredMark /></label>
                    <input
                      id="join2-surname"
                      type="text"
                      name="p2Surname"
                      value={form.p2Surname}
                      onChange={(e) => handleChange('p2Surname', e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {fieldErrors.p2Surname && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.p2Surname}</p>}
                  </div>
                  <div>
                    <label htmlFor="join2-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      id="join2-email"
                      type="email"
                      name="p2Email"
                      value={form.p2Email}
                      onChange={(e) => handleChange('p2Email', e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {fieldErrors.p2Email && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.p2Email}</p>}
                  </div>
                  <div>
                    <label htmlFor="join2-mobile" className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                    <input
                      id="join2-mobile"
                      type="tel"
                      name="p2Mobile"
                      value={form.p2Mobile}
                      onChange={(e) => handleChange('p2Mobile', e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Address */}
            <fieldset className="mb-6">
              <legend className="text-sm font-bold text-slate-700 mb-2">{isJoint ? 'Shared Address' : 'Address'}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="join-house-no" className="block text-sm font-medium text-slate-700 mb-1">House no / name</label>
                  <input
                    id="join-house-no"
                    type="text"
                    name="houseNo"
                    value={form.houseNo}
                    onChange={(e) => handleChange('houseNo', e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.houseNo ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-300'}`}
                  />
                  {fieldErrors.houseNo && <p className="text-red-600 text-xs mt-1">{fieldErrors.houseNo}</p>}
                </div>
                <div>
                  <label htmlFor="join-street" className="block text-sm font-medium text-slate-700 mb-1">Street</label>
                  <input
                    id="join-street"
                    type="text"
                    name="street"
                    value={form.street}
                    onChange={(e) => handleChange('street', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="join-town" className="block text-sm font-medium text-slate-700 mb-1">Town</label>
                  <input
                    id="join-town"
                    type="text"
                    name="town"
                    value={form.town}
                    onChange={(e) => handleChange('town', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="join-county" className="block text-sm font-medium text-slate-700 mb-1">County</label>
                  <input
                    id="join-county"
                    type="text"
                    name="county"
                    value={form.county}
                    onChange={(e) => handleChange('county', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="join-postcode" className="block text-sm font-medium text-slate-700 mb-1">Postcode <RequiredMark /></label>
                  <input
                    id="join-postcode"
                    type="text"
                    name="postcode"
                    value={form.postcode}
                    onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fieldErrors.postcode && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.postcode}</p>}
                </div>
                <div>
                  <label htmlFor="join-telephone" className="block text-sm font-medium text-slate-700 mb-1">Telephone</label>
                  <input
                    id="join-telephone"
                    type="tel"
                    name="telephone"
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
                  {isJoint
                    ? `I (${form.forenames.trim() || 'first person'}) would like Gift Aid claimed on my subscription`
                    : 'I would like my u3a to claim Gift Aid on my subscription'}
                </label>
                {isJoint && (
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input
                      type="checkbox"
                      checked={form.p2GiftAid}
                      onChange={(e) => handleChange('p2GiftAid', e.target.checked)}
                    />
                    I ({form.p2Forenames.trim() || 'second person'}) would like Gift Aid claimed on my subscription
                  </label>
                )}
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

            {config?.onlineJoinEmail && (
              <p className="text-xs text-slate-500 mb-4">
                For enquiries about joining, please contact{' '}
                <a href={`mailto:${config.onlineJoinEmail}`} className="text-blue-700 hover:underline">{config.onlineJoinEmail}</a>.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-3 text-sm font-medium transition-colors"
            >
              {submitting ? 'Processing...' : `Make Payment${displayFee ? ` — £${displayFee.toFixed(2)}` : ''}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
