// beacon2/frontend/src/pages/users/UserEditor.jsx
// Create or edit a system user and their role assignments.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { users as usersApi, roles as rolesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

export default function UserEditor() {
  const { id }   = useParams();
  const isNew    = !id || id === 'new';
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [active,       setActive]       = useState(true);
  const [allRoles,     setAllRoles]     = useState([]);
  const [assignedIds,  setAssignedIds]  = useState(new Set());
  const [origRoleIds,  setOrigRoleIds]  = useState(new Set());
  const [loading,      setLoading]      = useState(!isNew);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [roleList, user] = await Promise.all([
          rolesApi.list(),
          isNew ? null : usersApi.get(id),
        ]);
        setAllRoles(roleList);
        if (user) {
          setName(user.name);
          setEmail(user.email);
          setUsername(user.username ?? '');
          setActive(user.active);
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

  function toggleRole(roleId) {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  const handleSave = async () => {
    if (!name.trim())  { setError('Name is required.');  return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (username.trim() && !/^[a-z0-9]+$/.test(username.trim())) {
      setError('Username must be lowercase letters and numbers only (no spaces).');
      return;
    }
    if (isNew && !password) { setError('Password is required for new users.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await usersApi.create({
          name: name.trim(),
          email: email.trim(),
          username: username.trim() || undefined,
          password,
          active,
          roleIds: [...assignedIds],
        });
        navigate(`/users/${created.id}`);
      } else {
        const patch = { name: name.trim(), email: email.trim(), username: username.trim() || null, active };
        if (password) patch.password = password;
        await usersApi.update(id, patch);

        const toAdd    = [...assignedIds].filter((rid) => !origRoleIds.has(rid));
        const toRemove = [...origRoleIds].filter((rid) => !assignedIds.has(rid));
        await Promise.all([
          ...toAdd.map((rid)    => usersApi.assignRole(id, rid)),
          ...toRemove.map((rid) => usersApi.removeRole(id, rid)),
        ]);

        navigate('/users');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const canEdit = can('user_record', isNew ? 'create' : 'change');

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Users List', to: '/users' },
    ...(!isNew && can('user_record', 'create') ? [{ label: 'Add User', to: '/users/new' }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <p className="text-center mt-8 text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">

      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-5">

        <h1 className="text-xl font-bold text-center mb-4">
          {isNew ? 'Add User' : `Edit User: ${name}`}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* User details card */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              disabled={!canEdit} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Username <span className="text-slate-400 font-normal">(used to log in)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              disabled={!canEdit}
              placeholder="e.g. jbloggs"
              className={`${inputCls} font-mono`}
            />
            <p className="text-xs text-slate-400 mt-1">Lowercase letters and numbers only.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isNew ? 'Password' : 'New password'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!canEdit}
                placeholder={isNew ? 'Required' : 'Leave blank to keep current'}
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
                title={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Active</label>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={!canEdit}
              className="w-5 h-5 rounded border-slate-300 accent-blue-600"
            />
          </div>

          {canEdit && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save user'}
              </button>
              <button
                onClick={() => navigate('/users')}
                className="px-5 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Role assignments */}
        {allRoles.length > 0 && (
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
                  {saving ? 'Saving…' : 'Save user'}
                </button>
                <button
                  onClick={() => navigate('/users')}
                  className="px-5 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
