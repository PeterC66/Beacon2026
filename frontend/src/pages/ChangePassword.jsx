// beacon2/frontend/src/pages/ChangePassword.jsx
// Force-change-password screen (doc 4 — Logging in with a new password).
// Shown when must_change_password is true after login.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { auth as authApi } from '../lib/api.js';
import BeaconLogo from '../components/BeaconLogo.jsx';

const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const errInCls = 'w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';

const VALID_SPECIALS = '! @ # $ % ^ & *';

function validatePassword(pw) {
  const errors = [];
  if (pw.length < 10) errors.push('At least 10 characters');
  if (pw.length > 72) errors.push('Maximum 72 characters');
  if (/\s/.test(pw)) errors.push('No spaces allowed');
  if (!/[A-Z]/.test(pw)) errors.push('Include an uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('Include a lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('Include a number');
  return errors;
}

export default function ChangePassword() {
  const { user, clearMustChangePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    newPassword: '', confirm: '',
    question: 'Your first school', answer: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState(null);

  const pwErrors = validatePassword(form.newPassword);
  const passwordValid = pwErrors.length === 0;
  const passwordsMatch = form.newPassword === form.confirm && form.confirm.length > 0;
  const answerFilled = form.answer.trim().length > 0;
  const canSubmit = passwordValid && passwordsMatch && answerFilled && !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!passwordValid) errs.newPassword = pwErrors.join('. ');
    if (!passwordsMatch) errs.confirm = 'Passwords do not match.';
    if (!answerFilled) errs.answer = 'Please provide an answer.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true);
    setApiError(null);
    setErrors({});
    try {
      await authApi.forceChangePassword(form.newPassword, form.question.trim(), form.answer.trim());
      clearMustChangePassword();
      navigate('/');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-10 pb-10">
      <BeaconLogo large />

      <div className="mt-6 w-full max-w-md bg-amber-50 border border-amber-300 rounded-lg p-6">
        <h1 className="text-lg font-bold text-center text-amber-900 mb-2">
          Change password for {user?.name}
        </h1>

        <p className="text-sm text-amber-800 mb-1">
          Passwords should comprise minimum 10 characters with no spaces,
          including at least one upper case, lower case and numeric character.
        </p>
        <p className="text-sm text-amber-800 mb-4">
          Do not use common words. You may optionally consider using the following
          special characters: {VALID_SPECIALS}
        </p>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                name="newPassword"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                autoComplete="new-password"
                className={`${errors.newPassword ? errInCls : inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
                title={showPw ? 'Hide' : 'Show'}>
                {showPw ? '\u{1F648}' : '\u{1F441}'}
              </button>
            </div>
            {form.newPassword && pwErrors.length > 0 && (
              <p className="text-xs text-red-600 mt-1">{pwErrors.join(' \u00b7 ')}</p>
            )}
            {form.newPassword && passwordValid && (
              <p className="text-xs text-green-700 mt-1">Password meets requirements</p>
            )}
            {errors.newPassword && <p className="text-xs text-red-600 mt-1">{errors.newPassword}</p>}
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirm"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                autoComplete="new-password"
                className={`${errors.confirm ? errInCls : inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
                title={showConfirm ? 'Hide' : 'Show'}>
                {showConfirm ? '\u{1F648}' : '\u{1F441}'}
              </button>
            </div>
            {errors.confirm && <p className="text-xs text-red-600 mt-1">{errors.confirm}</p>}
            {!errors.confirm && passwordsMatch && (
              <p className="text-xs text-green-700 mt-1">Passwords match</p>
            )}
          </div>

          <hr className="border-amber-200" />

          <p className="text-sm font-semibold text-amber-900">
            Please also enter a personal question and answer
          </p>
          <p className="text-xs text-amber-800">
            You may answer the question given or change it to something else.
            The answer should be unknown by most other people.
          </p>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
            <input
              type="text"
              name="question"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              maxLength={200}
              className={inputCls}
            />
          </div>

          {/* Answer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Answer</label>
            <input
              type="text"
              name="answer"
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              maxLength={200}
              className={errors.answer ? errInCls : inputCls}
            />
            {errors.answer && <p className="text-xs text-red-600 mt-1">{errors.answer}</p>}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded font-medium text-sm transition-colors"
          >
            {busy ? 'Saving\u2026' : 'Submit'}
          </button>
        </form>
      </div>

      <button
        type="button"
        onClick={() => logout()}
        className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline"
      >
        Log out instead
      </button>
    </div>
  );
}
