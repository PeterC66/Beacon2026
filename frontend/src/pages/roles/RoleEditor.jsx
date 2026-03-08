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
  const [savingRole,  setSavingRole]  = useState(false);
  const [savingPrivs, setSavingPrivs] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
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

  const STANDARD_ACTIONS = ['view', 'create', 'change', 'delete'];

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

  const toggleOtherColumn = useCallback(() => {
    setGranted((prev) => {
      const next    = { ...prev };
      const pairs   = resources.flatMap((r) =>
        r.actions.filter((a) => !STANDARD_ACTIONS.includes(a)).map((a) => ({ r, a }))
      );
      const allOn   = pairs.every(({ r, a }) => next[`${r.id}:${a}`]);
      pairs.forEach(({ r, a }) => {
        const key = `${r.id}:${a}`;
        if (allOn) { delete next[key]; }
        else { next[key] = true; next[`${r.id}:view`] = true; }
      });
      return next;
    });
  }, [resources]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = useCallback((resourceId, possibleActions) => {
    setGranted((prev) => {
      const next  = { ...prev };
      const allOn = possibleActions.every((a) => next[`${resourceId}:${a}`]);
      if (allOn) { possibleActions.forEach((a) => delete next[`${resourceId}:${a}`]); }
      else       { possibleActions.forEach((a) => { next[`${resourceId}:${a}`] = true; }); }
      return next;
    });
  }, []);

  const handleSaveRole = async () => {
    if (!name.trim()) { setError('Role name is required.'); return; }
    setSavingRole(true);
    setError(null);
    try {
      if (isNew) {
        const created = await rolesApi.create({ name: name.trim(), isCommittee, notes });
        navigate(`/roles/${created.id}`);
      } else {
        await rolesApi.update(id, { name: name.trim(), isCommittee, notes });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleSavePrivileges = async () => {
    setSavingPrivs(true);
    setError(null);
    try {
      const privilegeList = Object.keys(granted).map((key) => {
        const [resourceId, action] = key.split(':');
        return { resourceId, action };
      });
      await rolesApi.setPrivileges(id, privilegeList);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPrivs(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!confirm(`Delete role "${name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await rolesApi.delete(id);
      navigate('/roles');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  const hasOtherActions  = resources.some((r) => r.actions.some((a) => !STANDARD_ACTIONS.includes(a)));

  const canEdit   = can('role_record', isNew ? 'create' : 'change');
  const canDelete = !isNew && can('role_record', 'delete');

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Roles List', to: '/roles' },
    ...(!isNew && can('role_record', 'create') ? [{ label: 'Add Role', to: '/roles/new' }] : []),
  ];

  const tenantDisplay = tenant
    ? tenant.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  const colHeadStyle = {
    fontStyle: 'italic',
    color: '#0000cc',
    textAlign: 'center',
    padding: '2px 6px',
    cursor: canEdit ? 'pointer' : 'default',
    minWidth: 52,
    fontWeight: 'normal',
  };

  const colHeaders = (
    <>
      <th style={{ minWidth: 220 }}></th>
      {STANDARD_ACTIONS.map((a) => (
        <th key={a} style={colHeadStyle} onClick={() => canEdit && toggleColumn(a)}>
          {a.charAt(0).toUpperCase() + a.slice(1)}
        </th>
      ))}
      {hasOtherActions && (
        <th style={{ ...colHeadStyle, minWidth: 120, cursor: canEdit ? 'pointer' : 'default' }}
            onClick={() => canEdit && toggleOtherColumn()}>
          Other
        </th>
      )}
    </>
  );

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
          Role Record
        </h1>

        {error && <div className="b-flash-error">{error}</div>}

        {/* Role details form */}
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
              {isNew && (
                <td style={{ paddingLeft: 10, color: '#555', fontStyle: 'italic' }}>New Role</td>
              )}
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
            {isNew && (
              <tr>
                <td></td>
                <td style={{ fontSize: 12, color: '#555', fontStyle: 'italic', paddingTop: 2 }}>
                  New record
                </td>
              </tr>
            )}
            {canEdit && (
              <tr>
                <td></td>
                <td style={{ paddingTop: 8 }}>
                  <button onClick={handleSaveRole} disabled={savingRole} style={{ marginRight: 8, padding: '3px 16px' }}>
                    {savingRole ? 'Saving…' : 'Save Role'}
                  </button>
                  {canDelete && (
                    <button onClick={handleDeleteRole} disabled={deleting} style={{ padding: '3px 16px' }}>
                      {deleting ? 'Deleting…' : 'Delete Role'}
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Privilege matrix — only shown when editing an existing role */}
        {!isNew && (
          <>
            <h2 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10 }}>Privileges</h2>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#555', marginBottom: 10 }}>
              Click a row or column heading to toggle all. View is required for any other action.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="b-priv-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>{colHeaders}</tr>
                </thead>
                <tbody>
                  {resources.map((resource, i) => {
                    const resourceOtherActions = resource.actions.filter((a) => !STANDARD_ACTIONS.includes(a));
                    return (
                      <tr key={resource.id} style={{ backgroundColor: i % 2 === 0 ? '#ffffcc' : '#f0f0f0' }}>
                        <td
                          style={{
                            color: '#0000cc',
                            fontStyle: 'italic',
                            cursor: canEdit ? 'pointer' : 'default',
                            padding: '2px 6px',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => canEdit && toggleRow(resource.id, resource.actions)}
                          title={canEdit ? 'Click to toggle all' : ''}
                        >
                          {resource.label}
                        </td>
                        {STANDARD_ACTIONS.map((action) => (
                          <td key={action} style={{ textAlign: 'center', padding: '2px 4px' }}>
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
                        {hasOtherActions && (
                          <td style={{ padding: '2px 8px' }}>
                            {resourceOtherActions.map((action) => (
                              <label key={action} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8, whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={!!granted[`${resource.id}:${action}`]}
                                  onChange={() => canEdit && toggle(resource.id, action)}
                                  disabled={!canEdit}
                                  style={{ marginRight: 3 }}
                                />
                                {action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')}
                              </label>
                            ))}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>{colHeaders}</tr>
                </tfoot>
              </table>
            </div>

            {canEdit && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  onClick={handleSavePrivileges}
                  disabled={savingPrivs}
                  style={{ padding: '4px 24px', backgroundColor: '#e08000', color: '#fff', border: '1px solid #b06000', borderRadius: 3, fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {savingPrivs ? 'Saving…' : 'Save Privileges'}
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
