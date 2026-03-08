// beacon2/frontend/src/pages/roles/RoleEditor.jsx
// Edit a role's name, committee flag, and privilege matrix.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roles as rolesApi, privileges as privsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

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
      const next  = { ...prev };
      const pairs = resources.flatMap((r) =>
        r.actions.filter((a) => !STANDARD_ACTIONS.includes(a)).map((a) => ({ r, a }))
      );
      const allOn = pairs.every(({ r, a }) => next[`${r.id}:${a}`]);
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

  const hasOtherActions = resources.some((r) => r.actions.some((a) => !STANDARD_ACTIONS.includes(a)));

  const canEdit   = can('role_record', isNew ? 'create' : 'change');
  const canDelete = !isNew && can('role_record', 'delete');

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Roles List', to: '/roles' },
    ...(!isNew && can('role_record', 'create') ? [{ label: 'Add Role', to: '/roles/new' }] : []),
  ];

  // ── Privilege table column headers (reused in thead, tfoot, and mid-table) ──
  const colHeadCls = 'text-[#0000cc] italic font-normal text-center px-1.5 py-1 border border-slate-300 text-sm cursor-pointer select-none';
  const colHeaders = (
    <>
      <th className="px-2 py-1 border border-slate-300 min-w-[180px]"></th>
      {STANDARD_ACTIONS.map((a) => (
        <th key={a} className={colHeadCls} style={{ minWidth: 52 }} onClick={() => canEdit && toggleColumn(a)}>
          {a.charAt(0).toUpperCase() + a.slice(1)}
        </th>
      ))}
      {hasOtherActions && (
        <th className={colHeadCls} style={{ minWidth: 120 }} onClick={() => canEdit && toggleOtherColumn()}>
          Other
        </th>
      )}
    </>
  );

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

      <div className="max-w-5xl mx-auto px-4 py-5">

        <h1 className="text-xl font-bold text-center mb-4">Role Record</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Role details card */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name
              {isNew && <span className="ml-2 text-xs text-slate-400 italic font-normal">New Role</span>}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className={`${inputCls} max-w-sm`}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Committee role</label>
            <input
              type="checkbox"
              checked={isCommittee}
              onChange={(e) => setIsCommittee(e.target.checked)}
              disabled={!canEdit}
              className="w-5 h-5 rounded border-slate-300 accent-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className={`${inputCls} max-w-sm resize-y`}
            />
          </div>

          {isNew && (
            <p className="text-xs text-slate-400 italic">New record</p>
          )}

          {canEdit && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSaveRole}
                disabled={savingRole}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-sm font-medium transition-colors"
              >
                {savingRole ? 'Saving…' : 'Save Role'}
              </button>
              {canDelete && (
                <button
                  onClick={handleDeleteRole}
                  disabled={deleting}
                  className="px-5 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete Role'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Privilege matrix — only shown when editing an existing role */}
        {!isNew && (
          <>
            <h2 className="text-lg font-bold text-center mb-2">Privileges</h2>
            <p className="text-center mb-3 text-sm">
              Click a row or column heading to toggle all. View is required for any other action.
            </p>

            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr className="bg-white">{colHeaders}</tr>
                </thead>
                <tbody>
                  {resources.map((resource, i) => {
                    const resourceOtherActions = resource.actions.filter((a) => !STANDARD_ACTIONS.includes(a));
                    const repeatHeader = i > 0 && i % 15 === 0;
                    return (
                      <>
                        {repeatHeader && (
                          <tr key={`hdr-${i}`} className="bg-white">{colHeaders}</tr>
                        )}
                        <tr key={resource.id} style={{ backgroundColor: i % 2 === 0 ? '#ffffcc' : '#f0f0f0' }}>
                          <td
                            style={{
                              color: '#0000cc',
                              fontStyle: 'italic',
                              textAlign: 'left',
                              cursor: canEdit ? 'pointer' : 'default',
                              padding: '2px 6px',
                              whiteSpace: 'nowrap',
                              border: '1px solid #ccc',
                              fontSize: '0.875rem',
                            }}
                            onClick={() => canEdit && toggleRow(resource.id, resource.actions)}
                            title={canEdit ? 'Click to toggle all' : ''}
                          >
                            {resource.label}
                          </td>
                          {STANDARD_ACTIONS.map((action) => (
                            <td key={action} style={{ textAlign: 'center', padding: '2px 4px', border: '1px solid #ccc' }}>
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
                            <td style={{ textAlign: 'left', padding: '2px 8px', border: '1px solid #ccc', fontSize: '0.875rem' }}>
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
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white">{colHeaders}</tr>
                </tfoot>
              </table>
            </div>

            {canEdit && (
              <div className="text-center mt-4">
                <button
                  onClick={handleSavePrivileges}
                  disabled={savingPrivs}
                  className="px-8 py-2 bg-[#e08000] hover:bg-[#c07000] disabled:opacity-50 text-white rounded font-bold text-sm transition-colors"
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
