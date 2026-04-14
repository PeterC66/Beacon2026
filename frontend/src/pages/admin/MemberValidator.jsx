// beacon2/frontend/src/pages/admin/MemberValidator.jsx
// Data quality validation for all member records.
// Re-fetches on every visit so results always reflect current data.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { UK_POSTCODE_RE } from '../../lib/constants.js';

function checkPostcode(v) {
  if (!v || !v.trim()) return 'Missing postcode';
  if (!UK_POSTCODE_RE.test(v.trim())) return 'Invalid UK postcode';
  return null;
}

function checkEmail(v) {
  if (!v || !v.trim()) return null;   // email is optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Invalid email address';
  return null;
}

function checkPhone(v, label) {
  if (!v || !v.trim()) return null;   // phone is optional
  try {
    if (!isValidPhoneNumber(v, 'GB')) return `Invalid UK ${label}`;
  } catch {
    return `Invalid UK ${label}`;
  }
  return null;
}

/** Returns an array of issue objects for a member record */
function getIssues(m) {
  const issues = [];

  // Missing mandatory fields
  if (!m.status_id) issues.push({ type: 'missing', field: 'status_id',  label: 'Status missing',      inline: false });
  if (!m.class_id)  issues.push({ type: 'missing', field: 'class_id',   label: 'Class missing',       inline: false });
  if (!m.joined_on) issues.push({ type: 'missing', field: 'joined_on',  label: 'Joined date missing',  inline: false });

  // Address / postcode
  const pcErr = checkPostcode(m.postcode);
  if (pcErr) issues.push({ type: 'postcode', field: 'postcode', label: pcErr, inline: true, currentValue: m.postcode ?? '' });

  // Email (optional but validate format if present)
  const emailErr = checkEmail(m.email);
  if (emailErr) issues.push({ type: 'email', field: 'email', label: emailErr, inline: true, currentValue: m.email ?? '' });

  // Mobile
  const mobileErr = checkPhone(m.mobile, 'mobile');
  if (mobileErr) issues.push({ type: 'mobile', field: 'mobile', label: mobileErr, inline: true, currentValue: m.mobile ?? '' });

  // Telephone (on address)
  const telErr = checkPhone(m.telephone, 'telephone');
  if (telErr) issues.push({ type: 'telephone', field: 'telephone', label: telErr, inline: true, currentValue: m.telephone ?? '' });

  return issues;
}

const ISSUE_COLOURS = {
  missing:   'bg-orange-50 border-orange-200 text-orange-800',
  postcode:  'bg-yellow-50 border-yellow-200 text-yellow-800',
  email:     'bg-red-50 border-red-200 text-red-800',
  mobile:    'bg-purple-50 border-purple-200 text-purple-800',
  telephone: 'bg-purple-50 border-purple-200 text-purple-800',
};

export default function MemberValidator() {
  const { tenant, can } = useAuth();
  const [data,    setData]    = useState(null);   // raw fetched member list
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Per-member inline edit state: { [memberId]: { [field]: { value, saving, saved, err } } }
  const [edits, setEdits] = useState({});

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Validate member data', to: '/admin/validate-members' },
  ];

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    membersApi.validate()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derive flagged members from fetched data (re-computed when data changes)
  const flagged = data
    ? data
        .map((m) => ({ ...m, issues: getIssues(m) }))
        .filter((m) => m.issues.length > 0)
    : [];

  // Summary counts
  const counts = flagged.reduce((acc, m) => {
    m.issues.forEach((iss) => { acc[iss.type] = (acc[iss.type] ?? 0) + 1; });
    return acc;
  }, {});

  // ── Inline edit handlers ──────────────────────────────────────────────────

  function setEditValue(memberId, field, value) {
    setEdits((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] ?? {}), [field]: { ...(prev[memberId]?.[field] ?? {}), value, saved: false, err: null } },
    }));
  }

  async function saveField(member, issue) {
    const memberId = member.id;
    const { field } = issue;
    const value = edits[memberId]?.[field]?.value ?? issue.currentValue;

    setEdits((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] ?? {}), [field]: { ...(prev[memberId]?.[field] ?? {}), saving: true, err: null } },
    }));

    try {
      // postcode and telephone live on the address; email and mobile on the member
      if (field === 'postcode' || field === 'telephone') {
        await membersApi.update(memberId, {
          address: {
            houseNo:   member.house_no   ?? undefined,
            street:    member.street     ?? undefined,
            addLine1:  member.add_line1  ?? undefined,
            addLine2:  member.add_line2  ?? undefined,
            town:      member.town       ?? undefined,
            county:    member.county     ?? undefined,
            postcode:  field === 'postcode'  ? value : (member.postcode   ?? undefined),
            telephone: field === 'telephone' ? value : (member.telephone  ?? undefined),
          },
        });
      } else {
        await membersApi.update(memberId, { [field]: value });
      }

      // Update local data so the issue disappears immediately
      setData((prev) => prev.map((m) => {
        if (m.id !== memberId) return m;
        if (field === 'postcode')   return { ...m, postcode:   value };
        if (field === 'telephone')  return { ...m, telephone:  value };
        if (field === 'email')      return { ...m, email:      value };
        if (field === 'mobile')     return { ...m, mobile:     value };
        return m;
      }));

      setEdits((prev) => ({
        ...prev,
        [memberId]: { ...(prev[memberId] ?? {}), [field]: { value, saving: false, saved: true, err: null } },
      }));
    } catch (err) {
      setEdits((prev) => ({
        ...prev,
        [memberId]: { ...(prev[memberId] ?? {}), [field]: { ...(prev[memberId]?.[field] ?? {}), saving: false, err: err.message } },
      }));
    }
  }

  const inputCls = 'border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold">Validate Member Data</h1>
          <button
            onClick={load}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {loading ? 'Checking…' : 'Re-check now'}
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary */}
            {flagged.length === 0 ? (
              <div className="rounded-md bg-green-50 border border-green-300 px-6 py-6 text-center">
                <p className="text-green-700 text-lg font-semibold">All member data is valid!</p>
                <p className="text-green-600 text-sm mt-1">
                  {data.length} member{data.length !== 1 ? 's' : ''} checked — no issues found.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <strong>{flagged.length} member{flagged.length !== 1 ? 's' : ''}</strong> with issues
                  {' '}(from {data.length} checked):
                  {' '}
                  {Object.entries(counts).map(([type, n]) => (
                    <span key={type} className="mr-3">
                      {n} {type === 'missing' ? 'missing field' : type}{n !== 1 ? 's' : ''}
                    </span>
                  ))}
                  <span className="ml-2 text-amber-600">— fix inline or open the member's record.</span>
                </div>

                {/* Flagged member list */}
                <div className="space-y-3">
                  {flagged.map((member) => (
                    <div key={member.id} className="bg-white/90 rounded-lg shadow-sm p-4">
                      {/* Member header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-medium text-slate-800">
                          #{member.membership_number} — {member.forenames} {member.surname}
                        </span>
                        <Link
                          to={`/members/${member.id}`}
                          className="text-blue-600 hover:underline text-sm whitespace-nowrap"
                        >
                          Open record →
                        </Link>
                      </div>

                      {/* Issues */}
                      <div className="space-y-2">
                        {member.issues.map((issue) => {
                          const editState = edits[member.id]?.[issue.field] ?? {};
                          const currentEdit = editState.value ?? issue.currentValue ?? '';

                          return (
                            <div
                              key={issue.field}
                              className={`rounded border px-3 py-2 text-sm flex flex-wrap items-center gap-2 ${ISSUE_COLOURS[issue.type]}`}
                            >
                              <span className="font-medium">{issue.label}</span>

                              {issue.inline ? (
                                <>
                                  <input
                                    type={issue.field === 'email' ? 'email' : 'text'}
                                    name="inlineEdit"
                                    value={currentEdit}
                                    onChange={(e) => setEditValue(member.id, issue.field, e.target.value)}
                                    placeholder={issue.field === 'postcode' ? 'e.g. SW1A 1AA' : ''}
                                    className={`${inputCls} flex-1 min-w-32`}
                                  />
                                  <button
                                    onClick={() => saveField(member, issue)}
                                    disabled={editState.saving}
                                    className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded px-3 py-1 text-xs font-medium transition-colors"
                                  >
                                    {editState.saving ? 'Saving…' : 'Save'}
                                  </button>
                                  {editState.saved && (
                                    <span className="text-green-700 text-xs font-medium">Saved ✓</span>
                                  )}
                                  {editState.err && (
                                    <span className="text-red-700 text-xs">{editState.err}</span>
                                  )}
                                </>
                              ) : (
                                <Link
                                  to={`/members/${member.id}`}
                                  className="underline text-sm ml-1"
                                >
                                  Fix in member record →
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {loading && (
          <p className="text-center text-slate-500 mt-8">Checking member data…</p>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
