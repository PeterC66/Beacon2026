// beacon2/frontend/src/pages/roles/RoleEditor.jsx
// Edit a role's name, committee flag, and privilege matrix.
// Used for both creating new roles and editing existing ones.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roles as rolesApi, privileges as privsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RoleEditor() {
  const { id }    = useParams();           // undefined for new role
  const isNew     = !id || id === 'new';
  const navigate  = useNavigate();
  const { can }   = useAuth();

  const [name,        setName]        = useState('');
  const [isCommittee, setIsCommittee] = useState(false);
  const [notes,       setNotes]       = useState('');
  const [resources,   setResources]   = useState([]);   // all privilege resources
  const [granted,     setGranted]     = useState({});   // { "resource_id:action": true }
  const [loading,     setLoading]     = useState(!isNew);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // ── Load privilege resources + existing role ────────────────────────────
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

          // Build granted map from role's privilege data
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

  // ── Toggle a single privilege cell ─────────────────────────────────────
  const toggle = useCallback((resourceId, action) => {
    const key = `${resourceId}:${action}`;
    setGranted((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
        // If un-ticking view, also remove create/change/delete (can't act without view)
        if (action === 'view') {
          Object.keys(next).forEach((k) => {
            if (k.startsWith(resourceId + ':')) delete next[k];
          });
        }
      } else {
        next[key] = true;
        // Auto-add view if ticking any other action
        if (action !== 'view') {
          next[`${resourceId}:view`] = true;
        }
      }
      return next;
    });
  }, []);

  // ── Toggle entire column ────────────────────────────────────────────────
  const toggleColumn = useCallback((action) => {
    setGranted((prev) => {
      const next = { ...prev };
      const eligible = resources.filter((r) => r.actions.includes(action));
      const allOn    = eligible.every((r) => next[`${r.id}:${action}`]);
      eligible.forEach((r) => {
        const key = `${r.id}:${action}`;
        if (allOn) {
          delete next[key];
        } else {
          next[key] = true;
          if (action !== 'view') next[`${r.id}:view`] = true;
        }
      });
      return next;
    });
  }, [resources]);

  // ── Toggle entire row ───────────────────────────────────────────────────
  const toggleRow = useCallback((resourceId, possibleActions) => {
    setGranted((prev) => {
      const next = { ...prev };
      const allOn = possibleActions.every((a) => next[`${resourceId}:${a}`]);
      if (allOn) {
        possibleActions.forEach((a) => delete next[`${resourceId}:${a}`]);
      } else {
        possibleActions.forEach((a) => { next[`${resourceId}:${a}`] = true; });
      }
      return next;
    });
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
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

      // Build privilege list from granted map
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

  // ── Column headers ───────────────────────────────────────────────────────
  const STANDARD_ACTIONS = ['view', 'create', 'change', 'delete'];

  // Collect all "other" action names (non-standard) across all resources
  const otherActions = [...new Set(
    resources.flatMap((r) => r.actions.filter((a) => !STANDARD_ACTIONS.includes(a)))
  )].sort();

  if (loading) return <PageShell><p className="text-slate-400 text-sm">Loading…</p></PageShell>;

  const canEdit = can('role_record', isNew ? 'create' : 'change');

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/roles')} className="text-blue-600 hover:underline text-sm mr-2">
            ← Roles
          </button>
          <h1 className="text-xl font-semibold text-slate-800 inline">
            {isNew ? 'New role' : `Edit: ${name}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/roles')}
            className="text-sm px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save role'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Role details */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCommittee}
                onChange={(e) => setIsCommittee(e.target.checked)}
                disabled={!canEdit}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-slate-700">Committee role</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEdit}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 resize-none"
          />
        </div>
      </div>

      {/* Privilege matrix */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-medium text-slate-700 text-sm">Privileges</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click a row or column header to toggle all. View is required for any other action.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-64">Resource</th>
                {STANDARD_ACTIONS.map((a) => (
                  <th key={a} className="px-3 py-3 font-medium text-slate-600 text-center capitalize">
                    {canEdit ? (
                      <button onClick={() => toggleColumn(a)} className="hover:text-blue-600 transition-colors">
                        {a}
                      </button>
                    ) : a}
                  </th>
                ))}
                {otherActions.map((a) => (
                  <th key={a} className="px-3 py-3 font-medium text-slate-600 text-center capitalize">
                    {canEdit ? (
                      <button onClick={() => toggleColumn(a)} className="hover:text-blue-600 transition-colors">
                        {a.replace(/_/g, ' ')}
                      </button>
                    ) : a.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource, i) => {
                const rowAllOn = resource.actions.every((a) => granted[`${resource.id}:${a}`]);
                return (
                  <tr key={resource.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                    <td className="px-4 py-2 text-slate-700">
                      {canEdit ? (
                        <button
                          onClick={() => toggleRow(resource.id, resource.actions)}
                          className={`hover:text-blue-600 text-left transition-colors ${rowAllOn ? 'font-medium' : ''}`}
                        >
                          {resource.label}
                        </button>
                      ) : resource.label}
                    </td>
                    {STANDARD_ACTIONS.map((action) => (
                      <td key={action} className="px-3 py-2 text-center">
                        {resource.actions.includes(action) ? (
                          <input
                            type="checkbox"
                            checked={!!granted[`${resource.id}:${action}`]}
                            onChange={() => canEdit && toggle(resource.id, action)}
                            disabled={!canEdit}
                            className="w-4 h-4 accent-blue-600 cursor-pointer disabled:cursor-default"
                          />
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    ))}
                    {otherActions.map((action) => (
                      <td key={action} className="px-3 py-2 text-center">
                        {resource.actions.includes(action) ? (
                          <input
                            type="checkbox"
                            checked={!!granted[`${resource.id}:${action}`]}
                            onChange={() => canEdit && toggle(resource.id, action)}
                            disabled={!canEdit}
                            className="w-4 h-4 accent-blue-600 cursor-pointer disabled:cursor-default"
                          />
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return <div className="p-6 max-w-5xl mx-auto">{children}</div>;
}
