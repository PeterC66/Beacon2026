// beacon2/frontend/src/pages/settings/PersonalPreferences.jsx
// Personal preferences — doc 9.1

import { useState, useEffect } from 'react';
import { auth as authApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { getPreferences, savePreferences } from '../../hooks/usePreferences.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function scorePassword(pw) {
  if (!pw) return { score: 0, hints: [] };
  const hints = [];
  let score = 0;
  if (pw.length >= 10) { score++; } else { hints.push('At least 10 characters'); }
  if (pw.length >= 14) { score++; }
  if (/[A-Z]/.test(pw)) { score++; } else { hints.push('Include an uppercase letter'); }
  if (/[a-z]/.test(pw)) { score++; } else { hints.push('Include a lowercase letter'); }
  if (/[0-9]/.test(pw)) { score++; } else { hints.push('Include a number'); }
  if (/\s/.test(pw)) { hints.push('No spaces allowed'); }
  return { score, hints };
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_BARS   = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500'];

export default function PersonalPreferences() {
  const { tenant } = useAuth();
  const navLinks = [{ label: 'Home', to: '/' }];
  const { markDirty, markClean } = useUnsavedChanges();

  // ── Section a: display prefs ────────────────────────────────────────
  const [prefs,      setPrefs]      = useState(getPreferences());
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [displaySaved, setDisplaySaved] = useState(false);

  function handleSaveDisplay(e) {
    e.preventDefault();
    savePreferences(prefs);
    markClean();
    setDisplaySaved(true);
    setTimeout(() => setDisplaySaved(false), 2500);
  }

  function handleSavePrefs(e) {
    e.preventDefault();
    savePreferences(prefs);
    markClean();
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2500);
  }

  // ── Section b: change password ──────────────────────────────────────
  const [pwForm,  setPwForm]  = useState({ current: '', newPw: '', confirm: '' });
  const [pwErr,   setPwErr]   = useState({});
  const [pwMsg,   setPwMsg]   = useState(null);
  const [pwBusy,  setPwBusy]  = useState(false);
  const { score: pwScore, hints: pwHints } = scorePassword(pwForm.newPw);

  function validatePw() {
    const errs = {};
    if (!pwForm.current)         errs.current = 'Enter your current password.';
    if (pwForm.newPw.length < 10) errs.newPw   = 'New password must be at least 10 characters.';
    if (/\s/.test(pwForm.newPw)) errs.newPw   = 'Password must not contain spaces.';
    if (!/[A-Z]/.test(pwForm.newPw)) errs.newPw = 'Password must include an uppercase letter.';
    if (!/[a-z]/.test(pwForm.newPw)) errs.newPw = 'Password must include a lowercase letter.';
    if (!/[0-9]/.test(pwForm.newPw)) errs.newPw = 'Password must include a number.';
    if (pwForm.newPw !== pwForm.confirm) errs.confirm = 'Passwords do not match.';
    return errs;
  }

  async function handleChangePw(e) {
    e.preventDefault();
    const errs = validatePw();
    if (Object.keys(errs).length) { setPwErr(errs); return; }
    setPwBusy(true);
    setPwMsg(null);
    setPwErr({});
    try {
      await authApi.changePassword(pwForm.current, pwForm.newPw);
      markClean();
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      if (err.status === 400) setPwErr({ current: err.body?.error ?? 'Incorrect password.' });
      else setPwMsg({ type: 'error', text: err.message });
    } finally { setPwBusy(false); }
  }

  // ── Section c: Q&A ──────────────────────────────────────────────────
  const [qa,      setQa]      = useState({ question: '', answer: '' });
  const [qaErr,   setQaErr]   = useState({});
  const [qaMsg,   setQaMsg]   = useState(null);
  const [qaBusy,  setQaBusy]  = useState(false);

  useEffect(() => {
    authApi.getQA().then((data) => {
      if (data.question) setQa((q) => ({ ...q, question: data.question }));
    }).catch(() => {});
  }, []);

  function validateQA() {
    const errs = {};
    if (!qa.question.trim()) errs.question = 'Enter a security question.';
    if (!qa.answer.trim())   errs.answer   = 'Enter a security answer.';
    return errs;
  }

  async function handleSaveQA(e) {
    e.preventDefault();
    const errs = validateQA();
    if (Object.keys(errs).length) { setQaErr(errs); return; }
    setQaBusy(true);
    setQaMsg(null);
    setQaErr({});
    try {
      await authApi.updateQA(qa.question.trim(), qa.answer.trim());
      markClean();
      setQaMsg({ type: 'success', text: 'Security Q&A updated.' });
      setQa((q) => ({ ...q, answer: '' }));
    } catch (err) {
      setQaMsg({ type: 'error', text: err.message });
    } finally { setQaBusy(false); }
  }

  // ── Shared input styles ─────────────────────────────────────────────
  const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const errInCls = 'w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';
  const errMsgCls = 'text-sm text-red-600 mt-1 font-medium';
  const sectionCls = 'bg-white/90 rounded-lg shadow-sm p-5 mb-5';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-5">Personal Preferences</h1>

        {/* ── Display preferences: text size & colour theme ──────── */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Display Preferences</h2>
          <form onSubmit={handleSaveDisplay} className="space-y-4" noValidate>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Text size</label>
              <div className="flex gap-3 flex-wrap">
                {[
                  { value: 'small',  label: 'Small' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'large',  label: 'Large' },
                  { value: 'xlarge', label: 'Extra Large' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="textSize" value={opt.value}
                      checked={prefs.textSize === opt.value}
                      onChange={(e) => { markDirty(); setPrefs((p) => ({ ...p, textSize: e.target.value })); }}
                      className="accent-blue-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colour theme</label>
              <div className="flex gap-3 flex-wrap">
                {[
                  { value: 'default',        label: 'Default' },
                  { value: 'high-contrast',  label: 'High Contrast' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="colorTheme" value={opt.value}
                      checked={prefs.colorTheme === opt.value}
                      onChange={(e) => { markDirty(); setPrefs((p) => ({ ...p, colorTheme: e.target.value })); }}
                      className="accent-blue-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                Save Display Preferences
              </button>
              {displaySaved && <span className="text-sm text-green-700 font-medium">Saved.</span>}
            </div>
          </form>
        </div>

        {/* ── Section a: Drop-down name lists & timeout ─────────────── */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Drop-down Name Lists &amp; Timeout</h2>
          <form onSubmit={handleSavePrefs} className="space-y-4" noValidate>

            <div>
              <label htmlFor="pref-sort-by" className="block text-sm font-medium text-slate-700 mb-1">Sort names by</label>
              <select id="pref-sort-by" name="sortBy" value={prefs.sortBy}
                onChange={(e) => { markDirty(); setPrefs((p) => ({ ...p, sortBy: e.target.value })); }}
                className={inputCls}>
                <option value="surname">Surname</option>
                <option value="forename">Forename</option>
              </select>
            </div>

            <div>
              <label htmlFor="pref-display-format" className="block text-sm font-medium text-slate-700 mb-1">Display format</label>
              <select id="pref-display-format" name="displayFormat" value={prefs.displayFormat}
                onChange={(e) => { markDirty(); setPrefs((p) => ({ ...p, displayFormat: e.target.value })); }}
                className={inputCls}>
                <option value="surname_first">Surname, Forename (e.g. Smith, John)</option>
                <option value="forename_first">Forename Surname (e.g. John Smith)</option>
              </select>
            </div>

            <div>
              <label htmlFor="pref-inactivity-timeout" className="block text-sm font-medium text-slate-700 mb-1">
                Session timeout (minutes, 5–99)
              </label>
              <input id="pref-inactivity-timeout" type="number" name="inactivityTimeout" min={5} max={99}
                value={prefs.inactivityTimeout}
                onChange={(e) => { markDirty(); setPrefs((p) => ({ ...p, inactivityTimeout: parseInt(e.target.value, 10) || 20 })); }}
                className={inputCls} style={{ width: '6rem' }} />
              <p className="text-xs text-slate-500 mt-1">
                After this many minutes of inactivity you will be logged out automatically.
                Default is 20 minutes. Do not increase on a shared computer.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                Save Name Lists &amp; Timeout
              </button>
              {prefsSaved && <span className="text-sm text-green-700 font-medium">Saved.</span>}
            </div>
          </form>
        </div>

        {/* ── Section b: Change password ────────────────────────────── */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Change Password</h2>
          <form onSubmit={handleChangePw} className="space-y-4" noValidate>

            <div>
              <label htmlFor="pref-current-password" className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
              <input id="pref-current-password" type="password" name="currentPassword" value={pwForm.current} autoComplete="current-password"
                onChange={(e) => { markDirty(); setPwForm((f) => ({ ...f, current: e.target.value })); }}
                className={pwErr.current ? errInCls : inputCls} />
              {pwErr.current && <p className={errMsgCls}>{pwErr.current}</p>}
            </div>

            <div>
              <label htmlFor="pref-new-password" className="block text-sm font-medium text-slate-700 mb-1">New password</label>
              <input id="pref-new-password" type="password" name="newPassword" value={pwForm.newPw} autoComplete="new-password"
                onChange={(e) => { markDirty(); setPwForm((f) => ({ ...f, newPw: e.target.value })); }}
                className={pwErr.newPw ? errInCls : inputCls} />
              {pwForm.newPw && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= pwScore ? STRENGTH_BARS[pwScore] : 'bg-slate-200'}`} />
                    ))}
                    <span className="text-xs text-slate-600 ml-1 whitespace-nowrap">{STRENGTH_LABELS[pwScore]}</span>
                  </div>
                  {pwHints.length > 0 && (
                    <p className="text-xs text-slate-500">{pwHints.join(' · ')}</p>
                  )}
                </div>
              )}
              {pwErr.newPw && <p className={errMsgCls}>{pwErr.newPw}</p>}
            </div>

            <div>
              <label htmlFor="pref-confirm-password" className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
              <input id="pref-confirm-password" type="password" name="confirmPassword" value={pwForm.confirm} autoComplete="new-password"
                onChange={(e) => { markDirty(); setPwForm((f) => ({ ...f, confirm: e.target.value })); }}
                className={pwErr.confirm ? errInCls : inputCls} />
              {pwErr.confirm && <p className={errMsgCls}>{pwErr.confirm}</p>}
              {!pwErr.confirm && pwForm.confirm && pwForm.newPw === pwForm.confirm && (
                <p className="text-sm text-green-700 mt-1">Passwords match ✓</p>
              )}
            </div>

            {pwMsg && (
              <p className={`text-sm font-medium ${pwMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>{pwMsg.text}</p>
            )}

            <button type="submit" disabled={pwBusy}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
              {pwBusy ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* ── Section c: Security Q&A ───────────────────────────────── */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Change Personal Q&amp;A</h2>
          <p className="text-sm text-slate-500 mb-4">
            Used for account recovery if you forget your password. Choose a question and answer
            that only you would know.
          </p>
          <form onSubmit={handleSaveQA} className="space-y-4" noValidate>

            <div>
              <label htmlFor="pref-security-question" className="block text-sm font-medium text-slate-700 mb-1">Question</label>
              <input id="pref-security-question" type="text" name="securityQuestion" value={qa.question} maxLength={200}
                placeholder="e.g. What was the name of your first pet?"
                onChange={(e) => { markDirty(); setQa((q) => ({ ...q, question: e.target.value })); }}
                className={qaErr.question ? errInCls : inputCls} />
              {qaErr.question && <p className={errMsgCls}>{qaErr.question}</p>}
            </div>

            <div>
              <label htmlFor="pref-security-answer" className="block text-sm font-medium text-slate-700 mb-1">Answer</label>
              <input id="pref-security-answer" type="text" name="securityAnswer" value={qa.answer} maxLength={200}
                placeholder="Your answer (remember the format)"
                onChange={(e) => { markDirty(); setQa((q) => ({ ...q, answer: e.target.value })); }}
                className={qaErr.answer ? errInCls : inputCls} />
              {qaErr.answer && <p className={errMsgCls}>{qaErr.answer}</p>}
            </div>

            {qaMsg && (
              <p className={`text-sm font-medium ${qaMsg.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>{qaMsg.text}</p>
            )}

            <button type="submit" disabled={qaBusy}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
              {qaBusy ? 'Saving…' : 'Update Q&A'}
            </button>
          </form>
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
