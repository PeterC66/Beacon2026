// beacon2/frontend/src/pages/users/UserEditor.jsx
// Create or edit a system user and their role assignments.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { users as usersApi, roles as rolesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import BeaconLogo from '../../components/BeaconLogo.jsx';

export default function UserEditor() {
  const { id }   = useParams();
  const isNew    = !id || id === 'new';
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
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
    if (isNew && !password) { setError('Password is required for new users.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await usersApi.create({
          name: name.trim(),
          email: email.trim(),
          password,
          active,
          roleIds: [...assignedIds],
        });
        navigate(`/users/${created.id}`);
      } else {
        const patch = { name: name.trim(), email: email.trim(), active };
        if (password) patch.password = password;
        await usersApi.update(id, patch);

        // Diff role assignments
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

  const tenantDisplay = tenant
    ? tenant.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 32px 8px' }}>
          <BeaconLogo />
        </div>
        <NavBar links={navLinks} />
        <p style={{ textAlign: 'center', marginTop: 20, color: '#555' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 40 }}>

      {/* Logo + tenant header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 32px 8px' }}>
        <BeaconLogo />
        {tenantDisplay && (
          <span style={{ fontFamily: 'Arial', fontSize: 42, marginLeft: 24, color: '#000' }}>
            {tenantDisplay}
          </span>
        )}
      </div>

      <NavBar links={navLinks} />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '12px 16px' }}>

        <h1 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 14 }}>
          {isNew ? 'Add User' : `Edit User: ${name}`}
        </h1>

        {error && <div className="b-flash-error">{error}</div>}

        {/* User details form */}
        <table className="b-form-table" style={{ margin: '0 auto 20px' }}>
          <tbody>
            <tr>
              <td className="b-label">Name</td>
              <td>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                  style={{ width: 280 }}
                />
              </td>
            </tr>
            <tr>
              <td className="b-label">Email</td>
              <td>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEdit}
                  style={{ width: 280 }}
                />
              </td>
            </tr>
            <tr>
              <td className="b-label">{isNew ? 'Password' : 'New password'}</td>
              <td>
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!canEdit}
                    placeholder={isNew ? 'Required' : 'Leave blank to keep current'}
                    style={{ width: 256, paddingRight: 24 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    style={{
                      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0,
                    }}
                    title={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? '🙈' : '👁'}
                  </button>
                </span>
              </td>
            </tr>
            <tr>
              <td className="b-label">Active</td>
              <td>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={!canEdit}
                />
              </td>
            </tr>
            {canEdit && (
              <tr>
                <td></td>
                <td style={{ paddingTop: 8 }}>
                  <button onClick={handleSave} disabled={saving} style={{ marginRight: 8, padding: '3px 16px' }}>
                    {saving ? 'Saving…' : 'Save user'}
                  </button>
                  <button onClick={() => navigate('/users')} style={{ padding: '3px 16px' }}>
                    Cancel
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Role assignments */}
        {allRoles.length > 0 && (
          <>
            <h2 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10 }}>Roles</h2>
            <table className="b-table" style={{ margin: '0 auto' }}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Committee role</th>
                  <th style={{ textAlign: 'center' }}>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {allRoles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.name}</td>
                    <td style={{ textAlign: 'center' }}>{role.is_committee ? 'Y' : ''}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={assignedIds.has(role.id)}
                        onChange={() => canEdit && toggleRole(role.id)}
                        disabled={!canEdit}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canEdit && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={handleSave} disabled={saving} style={{ marginRight: 8, padding: '3px 16px' }}>
                  {saving ? 'Saving…' : 'Save user'}
                </button>
                <button onClick={() => navigate('/users')} style={{ padding: '3px 16px' }}>
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
