// beacon2/frontend/src/pages/users/UserEditor.jsx
// Create or edit a system user and their role assignments (doc 8.2).

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { users as usersApi, roles as rolesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

export default function UserEditor() {
  const { id }   = useParams();
  const isNew    = !id || id === 'new';
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [memberId,       setMemberId]       = useState('');
  const [availableMembers, setAvailableMembers] = useState([]);
  const [username,       setUsername]       = useState('');
  const [email,          setEmail]          = useState('');
  const [active,         setActive]         = useState(true);
  const [isSiteAdmin,    setIsSiteAdmin]    = useState(false);
  const [memberName,     setMemberName]     = useState('');
  const [allRoles,       setAllRoles]       = useState([]);
  const [assignedIds,    setAssignedIds]    = useState(new Set());
  const [origRoleIds,    setOrigRoleIds]    = useState(new Set());
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState(null);
  const [tempPwMsg,      setTempPwMsg]      = useState(null);
  const savedTimer = useRef(null);
  const { markDirty, markClean } = useUnsavedChanges();

  // Existing user fields (for edit mode display)
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const promises = [rolesApi.list()];
        if (isNew) {
          promises.push(usersApi.availableMembers());
          promises.push(null);
        } else {
          promises.push(null);
          promises.push(usersApi.get(id));
        }
        const [roleList, memberList, user] = await Promise.all(promises);
        setAllRoles(roleList);
        if (memberList) setAvailableMembers(memberList);
        if (user) {
          setUserName(user.name);
          setEmail(user.email);
          setUsername(user.username ?? '');
          setActive(user.active);
          setIsSiteAdmin(user.is_site_admin || false);
          setMemberId(user.member_id || '');
          setMemberName(user.member_name || '');
          const ids = new Set(user.roles.map((r) => r.id));
          setAssignedIds(ids);
          setOrigRoleIds(new Set(ids));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isNew]);

  // When member selection changes in create mode, auto-fill email
  function handleMemberChange(e) {
    markDirty();
    const mid = e.target.value;
    setMemberId(mid);
    if (mid) {
      const member = availableMembers.find((m) => m.id === mid);
      if (member?.email) setEmail(member.email);
    }
  }

  function toggleRole(roleId) {
    markDirty();
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  const handleSave = async () => {
    if (isNew) {
      if (!memberId)       { setError('Please select a member.'); return; }
      if (!username.trim()) { setError('Username is required.');   return; }
    }
    if (username.trim() && !/^[a-z0-9]+$/.test(username.trim())) {
      setError('Username must be lowercase letters and numbers only (no spaces).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await usersApi.create({
          memberId,
          username: username.trim(),
          email: email.trim() || undefined,
          active,
          roleIds: [...assignedIds],
        });
        markClean();
        // Show temp password notice
        setTempPwMsg(
          `The new user has been set the temporary password of ${created.tempPassword}\nwhich they will need to change at first login.\nNow please establish the user's roles.`
        );
        setSaved(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => navigate(`/users/${created.id}`), 3000);
      } else {
        const patch = { username: username.trim() || null, active };
        if (email.trim()) patch.email = email.trim();
        await usersApi.update(id, patch);

        const toAdd    = [...assignedIds].filter((rid) => !origRoleIds.has(rid));
        const toRemove = [...origRoleIds].filter((rid) => !assignedIds.has(rid));
        await Promise.all([
          ...toAdd.map((rid)    => usersApi.assignRole(id, rid)),
          ...toRemove.map((rid) => usersApi.removeRole(id, rid)),
        ]);

        markClean();
        setSaved(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => navigate('/users'), 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetTempPassword = async () => {
    if (!confirm('Set a new temporary password for this user? They will need to change it on next login.')) return;
    try {
      const result = await usersApi.setTempPassword(id);
      setTempPwMsg(`Temporary password set: ${result.tempPassword}\nPlease notify the user of their new password.`);
    } catch (err) {
      alert(err.message);
    }
  };

  const canEdit = can('user_record', isNew ? 'create' : 'change');

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Users List', to: '/users' },
    ...(!isNew && can('user_record', 'create') ? [{ label: 'Add New User', to: '/users/new' }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <p className="text-center mt-8 text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">

      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-5">

        <h1 className="text-xl font-bold text-center mb-4">
          {isNew ? 'Add New User' : 'System User Record'}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {saved && !tempPwMsg && (
          <p className="mb-4 text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2 text-center">
            Saved successfully.
          </p>
        )}

        {tempPwMsg && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-300 rounded text-blue-800 text-sm whitespace-pre-line text-center">
            <p className="font-bold mb-1">Notice</p>
            {tempPwMsg}
          </div>
        )}

        {/* User details card */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-6 space-y-4">

          {/* Member selection (new) or display (edit) */}
          {isNew ? (
            <div>
              <label htmlFor="user-member" className="block text-sm font-medium text-slate-700 mb-1">Member</label>
              <select
                id="user-member"
                name="memberId"
                value={memberId}
                onChange={handleMemberChange}
                disabled={!canEdit}
                className={inputCls}
              >
                <option value="">-- Select a member --</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.surname}, {m.forenames}{m.email ? ` (${m.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Member:</label>
              {memberId ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm">{memberName}</span>
                  <button
                    onClick={() => navigate(`/members/${memberId}`)}
                    className="text-blue-700 hover:underline text-sm"
                    title="View member record"
                  >
                    ...
                  </button>
                </span>
              ) : (
                <span className="text-sm text-slate-400">
                  {isSiteAdmin ? 'Not required for Site Administrator' : 'Not linked'}
                </span>
              )}
            </div>
          )}

          {/* Site Admin indicator */}
          {!isNew && isSiteAdmin && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              This user is the <strong>Site Administrator</strong> and has ALL privileges.
            </div>
          )}

          <div>
            <label htmlFor="user-username" className="block text-sm font-medium text-slate-700 mb-1">
              Login name <span className="text-slate-400 font-normal">(username)</span>
            </label>
            <input
              id="user-username"
              type="text"
              name="username"
              value={username}
              onChange={(e) => { markDirty(); setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')); }}
              disabled={!canEdit}
              placeholder="e.g. jbloggs"
              className={`${inputCls} font-mono`}
            />
            <p className="text-xs text-slate-400 mt-1">Lowercase letters and numbers only. Personal to the user, not a role name.</p>
          </div>

          <div>
            <label htmlFor="user-email" className="block text-sm font-medium text-slate-700 mb-1">User's E-mail</label>
            <input id="user-email" type="email" name="email" value={email} onChange={(e) => { markDirty(); setEmail(e.target.value); }}
              disabled={!canEdit} className={inputCls} />
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="user-active" className="text-sm font-medium text-slate-700">Active</label>
            <input
              id="user-active"
              type="checkbox"
              checked={active}
              onChange={(e) => { markDirty(); setActive(e.target.checked); }}
              disabled={!canEdit}
              className="w-5 h-5 rounded border-slate-300 accent-blue-600"
            />
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save user'}
              </button>
              {!isNew && (
                <button
                  onClick={handleSetTempPassword}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-medium transition-colors"
                >
                  Set Temporary Password
                </button>
              )}
              <button
                onClick={() => { markClean(); navigate('/users'); }}
                className="px-5 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Role assignments */}
        {!isSiteAdmin && allRoles.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-center mb-3">Roles</h2>
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table className="w-full text-sm bg-white min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <th className="px-4 py-2.5 font-normal">Role</th>
                    <th className="px-4 py-2.5 font-normal text-center">Committee role</th>
                    <th className="px-4 py-2.5 font-normal text-center">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {allRoles.map((role, i) => (
                    <tr key={role.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      <td className="px-4 py-2.5">{role.name}</td>
                      <td className="px-4 py-2.5 text-center">{role.is_committee ? 'Y' : ''}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={assignedIds.has(role.id)}
                          onChange={() => canEdit && toggleRole(role.id)}
                          disabled={!canEdit}
                          className="w-5 h-5 rounded border-slate-300 accent-blue-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="flex justify-center gap-3 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Role Assignment'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Site admin: show message about roles */}
        {!isNew && isSiteAdmin && (
          <div className="text-center text-sm text-slate-500 mt-4">
            The Site Administrator has all privileges regardless of role assignments.
          </div>
        )}

      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
