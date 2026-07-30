// beacon2026/frontend/src/pages/public/PortalRegister.jsx
// Members Portal registration page (public, unauthenticated).

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';
import RequiredMark from '../../components/RequiredMark.jsx';
import { scrollToFirstFieldError } from '../../lib/scrollToError.js';
import PortalVersion from '../../components/PortalVersion.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import FormError from '../../components/FormError.jsx';
import { inputCls, labelCls } from '../../components/ui/Input.jsx';

export default function PortalRegister() {
  const { slug } = useParams();
  const [form, setForm] = useState({
    membershipNumber: '',
    forename: '',
    surname: '',
    postcode: '',
    email: '',
    password: '',
    confirmPassword: '',
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
    else if (!/[a-z]/.test(form.password))
      errs.password = 'Password must contain a lowercase letter.';
    else if (!/[A-Z]/.test(form.password))
      errs.password = 'Password must contain an uppercase letter.';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a number.';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstFieldError(Object.keys(errs));
      return;
    }

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
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <PortalVersion />
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-green-700 mb-2">Registration Successful</h1>
          <p className="text-sm text-slate-600 mb-4">
            We have sent you a verification email. Please click the link in the email to confirm
            your account.
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

  const fieldCss = `${inputCls} w-full`;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <PortalVersion />
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
              <label htmlFor="pr-membership-number" className={labelCls}>
                Membership number <RequiredMark />
              </label>
              <input
                id="pr-membership-number"
                type="number"
                name="membershipNumber"
                value={form.membershipNumber}
                onChange={(e) => handleChange('membershipNumber', e.target.value)}
                className={fieldCss}
              />
              <FormError error={fieldErrors.membershipNumber} />
            </div>
            <div>
              <label htmlFor="pr-forename" className={labelCls}>
                Forename <RequiredMark />
              </label>
              <input
                id="pr-forename"
                type="text"
                name="forename"
                value={form.forename}
                onChange={(e) => handleChange('forename', e.target.value)}
                className={fieldCss}
              />
              <FormError error={fieldErrors.forename} />
            </div>
            <div>
              <label htmlFor="pr-surname" className={labelCls}>
                Surname <RequiredMark />
              </label>
              <input
                id="pr-surname"
                type="text"
                name="surname"
                value={form.surname}
                onChange={(e) => handleChange('surname', e.target.value)}
                className={fieldCss}
              />
              <FormError error={fieldErrors.surname} />
            </div>
            <div>
              <label htmlFor="pr-postcode" className={labelCls}>
                Postcode <RequiredMark />
              </label>
              <input
                id="pr-postcode"
                type="text"
                name="postcode"
                value={form.postcode}
                onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
                className={fieldCss}
              />
              <FormError error={fieldErrors.postcode} />
            </div>
            <div>
              <label htmlFor="pr-email" className={labelCls}>
                Email address <RequiredMark />
              </label>
              <input
                id="pr-email"
                type="email"
                name="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={fieldCss}
                autoComplete="email"
              />
              <FormError error={fieldErrors.email} />
            </div>
          </div>

          <fieldset className="mb-6">
            <legend className="text-sm font-bold text-slate-700 mb-2">Create a password</legend>
            <p className="text-xs text-slate-500 mb-2">
              10–72 characters, with at least one uppercase, one lowercase, and one number.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="pr-password" className={labelCls}>
                  Password <RequiredMark />
                </label>
                <PasswordInput
                  id="pr-password"
                  name="password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className={fieldCss}
                  autoComplete="new-password"
                />
                <FormError error={fieldErrors.password} />
              </div>
              <div>
                <label htmlFor="pr-confirm-password" className={labelCls}>
                  Confirm password <RequiredMark />
                </label>
                <PasswordInput
                  id="pr-confirm-password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className={fieldCss}
                  autoComplete="new-password"
                />
                <FormError error={fieldErrors.confirmPassword} />
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
