// beacon2/frontend/src/pages/roles/RoleEditor.jsx
// Edit a role's name, committee flag, and privilege matrix.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roles as rolesApi, privileges as privsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import BeaconLogo from '../../components/BeaconLogo.jsx';

export default function RoleEditor() {
  const { id }   = useParams();
  const isNew    = !id || id === 'new';
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [name,        setName]        = useState('');
  const [isCommittee, setIsCommittee] = useState(false);
  const [notes,       setNotes]       = useState('');
  const [resources,   setResources]   = useState([]);
  const [granted,     setGranted]     = useState({});
  const [loading,     setLoading]     = useState(!isNew);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [resourceList, role] = await Promise.all([
          privsApi.resources(),
          isNew ? null : rolesApi.get(id),
        ]);
        setResources(resourceList);
        if (role) {
          setName(role.name);
          setIsCommittee(role.is_committee);
          setNotes(role.notes ?? '');
          const map = {};
          for (const res of role.privileges) {
            for (const action of res.granted_actions) {
              map[`${res.resource_id}:${action}`] = true;
            }
          }
          setGranted(map);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isNew]);

  const toggle = useCallback((resourceId, action) => {
    const key = `${resourceId}:${action}`;
    setGranted((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
        if (action === 'view') {
          Object.keys(next).forEach((k) => { if (k.startsWith(resourceId + ':')) delete next[k]; });
        }
      } else {
        next[key] = true;
        if (action !== 'view') next[`${resourceId}:view`] = true;
      }
      return next;
    });
  }, []);

  const toggleColumn = useCallback((action) => {
    setGranted((prev) => {
      const next     = { ...prev };
      const eligible = resources.filter((r) => r.actions.includes(action));
      const allOn    = eligible.every((r) => next[`${r.id}:${action}`]);
      eligible.forEach((r) => {
        const key = `${r.id}:${action}`;
        if (allOn) { delete next[key]; }
        else { next[key] = true; if (action !== 'view') next[`${r.id}:view`] = true; }
      });
      return next;
    });
  }, [resources]);

  const toggleRow = useCallback((resourceId, possibleActions) => {
    setGranted((prev) => {
      const next  = { ...prev };
      const allOn = possibleActions.every((a) => next[`${resourceId}:${a}`]);
      if (allOn) { possibleActions.forEach((a) => delete next[`${resourceId}:${a}`]); }
      else       { possibleActions.forEach((a) => { next[`${resourceId}:${a}`] = true; }); }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      let roleId = id;
      if (isNew) {
        const created = await rolesApi.create({ name: name.trim(), isCommittee, notes });
        roleId = created.id;
      } else {
        await rolesApi.update(id, { name: name.trim(), isCommittee, notes });
      }
      const privilegeList = Object.keys(granted).map((key) => {
        const [resourceId, action] = key.split(':');
        return { resourceId, action };
      });
      await rolesApi.setPrivileges(roleId, privilegeList);
      navigate('/roles');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const STANDARD_ACTIONS = ['view', 'create', 'change', 'delete'];
  const otherActions = [...new Set(
    resources.flatMap((r) => r.actions.filter((a) => !STANDARD_ACTIONS.includes(a)))
  )].sort();

  const canEdit = can('role_record', isNew ? 'create' : 'change');

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Roles List', to: '/roles' },
    ...(!isNew && can('role_record', 'create') ? [{ label: 'Add Role', to: '/roles/new' }] : []),
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

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '12px 16px' }}>

        <h1 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 14 }}>
          {isNew ? 'Add Role' : `Edit Role: ${name}`}
        </h1>

        {error && <div className="b-flash-error">{error}</div>}

        {/* Role details form */}
        <table className="b-form-table" style={{ margin: '0 auto 20px' }}>
          <tbody>
            <tr>
              <td className="b-label">Role name</td>
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
              <td className="b-label">Committee role</td>
              <td>
                <input
                  type="checkbox"
                  checked={isCommittee}
                  onChange={(e) => setIsCommittee(e.target.checked)}
                  disabled={!canEdit}
                />
              </td>
            </tr>
            <tr>
              <td className="b-label" style={{ verticalAlign: 'top', paddingTop: 6 }}>Notes</td>
              <td>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  style={{ width: 280, fontFamily: 'Arial', fontSize: 13, border: '1px solid #777', padding: '2px 4px', resize: 'vertical' }}
                />
              </td>
            </tr>
            {canEdit && (
              <tr>
                <td></td>
                <td style={{ paddingTop: 8 }}>
                  <button onClick={handleSave} disabled={saving} style={{ marginRight: 8, padding: '3px 16px' }}>
                    {saving ? 'Saving…' : 'Save role'}
                  </button>
                  <button onClick={() => navigate('/roles')} style={{ padding: '3px 16px' }}>
                    Cancel
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Privilege matrix */}
        <h2 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10 }}>Privileges</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#555', marginBottom: 10 }}>
          Click a row or column heading to toggle all. View is required for any other action.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="b-priv-table">
            <thead>
              <tr>
                <th className="b-res-head" style={{ minWidth: 220 }}>Resource</th>
                {STANDARD_ACTIONS.map((a) => (
                  <th key={a} onClick={() => canEdit && toggleColumn(a)} style={{ textTransform: 'capitalize', minWidth: 60 }}>
                    {a}
                  </th>
                ))}
                {otherActions.map((a) => (
                  <th key={a} onClick={() => canEdit && toggleColumn(a)} style={{ minWidth: 80 }}>
                    {a.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id}>
                  <td
                    className="b-res-name"
                    onClick={() => canEdit && toggleRow(resource.id, resource.actions)}
                    title={canEdit ? 'Click to toggle all' : ''}
                  >
                    {resource.label}
                  </td>
                  {STANDARD_ACTIONS.map((action) => (
                    <td key={action} style={{ textAlign: 'center' }}>
                      {resource.actions.includes(action) ? (
                        <input
                          type="checkbox"
                          checked={!!granted[`${resource.id}:${action}`]}
                          onChange={() => canEdit && toggle(resource.id, action)}
                          disabled={!canEdit}
                        />
                      ) : ''}
                    </td>
                  ))}
                  {otherActions.map((action) => (
                    <td key={action} style={{ textAlign: 'center' }}>
                      {resource.actions.includes(action) ? (
                        <input
                          type="checkbox"
                          checked={!!granted[`${resource.id}:${action}`]}
                          onChange={() => canEdit && toggle(resource.id, action)}
                          disabled={!canEdit}
                        />
                      ) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving} style={{ marginRight: 8, padding: '3px 16px' }}>
              {saving ? 'Saving…' : 'Save role'}
            </button>
            <button onClick={() => navigate('/roles')} style={{ padding: '3px 16px' }}>
              Cancel
            </button>
          </div>
        )}

      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
