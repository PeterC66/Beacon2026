// beacon2/frontend/src/pages/public/PortalRegister.jsx
// Members Portal registration page (public, unauthenticated).

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';

export default function PortalRegister() {
  const { slug } = useParams();
  const [form, setForm] = useState({
    membershipNumber: '', forename: '', surname: '',
    postcode: '', email: '', password: '', confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.membershipNumber) errs.membershipNumber = 'Membership number is required.';
    if (!form.forename.trim()) errs.forename = 'Forename is required.';
    if (!form.surname.trim()) errs.surname = 'Surname is required.';
    if (!form.postcode.trim()) errs.postcode = 'Postcode is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    if (!form.password) errs.password = 'Password is required.';
    else if (form.password.length < 10) errs.password = 'Password must be at least 10 characters.';
    else if (!/[a-z]/.test(form.password)) errs.password = 'Password must contain a lowercase letter.';
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Password must contain an uppercase letter.';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a number.';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
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
      await publicApi.portalRegister(slug, {
        membershipNumber: parseInt(form.membershipNumber, 10),
        forename: form.forename.trim(),
        surname: form.surname.trim(),
        postcode: form.postcode.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-green-700 mb-2">Registration Successful</h1>
          <p className="text-sm text-slate-600 mb-4">
            We have sent you a verification email. Please click the link in the email to confirm your account.
          </p>
          <p className="text-xs text-slate-500 mb-4">
            If the email doesn't arrive within a few minutes, check your Spam folder.
          </p>
          <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline text-sm">
            Return to sign-in
          </Link>
        </div>
      </div>
    );
  }

  const fieldCss = "w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-center mb-1">Register for Members Portal</h1>
        <p className="text-sm text-slate-600 text-center mb-6">
          Please enter your details exactly as they appear on your membership record.
        </p>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-3 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Membership number *</label>
              <input type="number" value={form.membershipNumber}
                onChange={(e) => handleChange('membershipNumber', e.target.value)} className={fieldCss} />
              {fieldErrors.membershipNumber && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.membershipNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forename *</label>
              <input type="text" value={form.forename}
                onChange={(e) => handleChange('forename', e.target.value)} className={fieldCss} />
              {fieldErrors.forename && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.forename}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Surname *</label>
              <input type="text" value={form.surname}
                onChange={(e) => handleChange('surname', e.target.value)} className={fieldCss} />
              {fieldErrors.surname && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.surname}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Postcode *</label>
              <input type="text" value={form.postcode}
                onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())} className={fieldCss} />
              {fieldErrors.postcode && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.postcode}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address *</label>
              <input type="email" value={form.email}
                onChange={(e) => handleChange('email', e.target.value)} className={fieldCss} autoComplete="email" />
              {fieldErrors.email && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.email}</p>}
            </div>
          </div>

          <fieldset className="mb-6">
            <legend className="text-sm font-bold text-slate-700 mb-2">Create a password</legend>
            <p className="text-xs text-slate-500 mb-2">
              10–72 characters, with at least one uppercase, one lowercase, and one number.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <input type="password" value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)} className={fieldCss} autoComplete="new-password" />
                {fieldErrors.password && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password *</label>
                <input type="password" value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)} className={fieldCss} autoComplete="new-password" />
                {fieldErrors.confirmPassword && <p className="text-sm text-red-600 mt-1 font-medium">{fieldErrors.confirmPassword}</p>}
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-3 text-sm font-medium transition-colors mb-4"
          >
            {submitting ? 'Registering...' : 'Update Account'}
          </button>
        </form>

        <div className="text-center text-sm">
          <Link to={`/public/${slug}/portal`} className="text-blue-700 hover:underline">
            Already registered? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
