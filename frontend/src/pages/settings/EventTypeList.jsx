// beacon2/frontend/src/pages/settings/EventTypeList.jsx
// Manage event types for non-group events (e.g. Open Meetings, Social Events).

import { useState, useEffect } from 'react';
import { eventTypes as eventTypesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

export default function EventTypeList() {
  const { can, tenant } = useAuth();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // Add new
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addError, setAddError] = useState(null);
  const [addSaving, setAddSaving] = useState(false);

  const canChange = can('event_types', 'change');
  const canCreate = can('event_types', 'create');
  const canDelete = can('event_types', 'delete');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setList(await eventTypesApi.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(et) {
    setEditingId(et.id);
    setEditName(et.name);
    setEditDesc(et.description ?? '');
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setEditError(null);
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await eventTypesApi.update(id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      setList((prev) => prev.map((et) => et.id === id ? updated : et));
      cancelEdit();
    } catch (err) {
      setEditError(err.body?.error || err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete event type "${name}"? This cannot be undone.`)) return;
    try {
      await eventTypesApi.remove(id);
      setList((prev) => prev.filter((et) => et.id !== id));
    } catch (err) {
      setError(err.body?.error || err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const created = await eventTypesApi.create({
        name: newName.trim(),
        description: newDesc.trim() || null,
      });
      setList((prev) => [...prev, created]);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      setAddError(err.body?.error || err.message);
    } finally {
      setAddSaving(false);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Calendar', to: '/calendar' },
  ];

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Event Types</h1>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading...</p>
        ) : (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-x-auto mb-6">
            {list.length === 0 ? (
              <p className="text-slate-500 text-sm p-4">No event types yet. Add one below.</p>
            ) : (
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <th className="px-4 py-2.5 font-normal">Name</th>
                    <th className="px-4 py-2.5 font-normal">Description</th>
                    {(canChange || canDelete) && <th className="px-4 py-2.5 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((et, i) => (
                    <tr key={et.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      {editingId === et.id ? (
                        <>
                          <td className="px-4 py-2" colSpan={2}>
                            <div className="flex flex-wrap gap-2 items-start">
                              <div className="flex-1 min-w-40">
                                <input className={`${inputCls} w-full`} name="editName" value={editName}
                                  onChange={(e) => setEditName(e.target.value)} autoFocus
                                  disabled={et.is_default}
                                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }} />
                              </div>
                              <div className="flex-1 min-w-48">
                                <input className={`${inputCls} w-full`} name="editDesc" value={editDesc}
                                  placeholder="Description"
                                  onChange={(e) => setEditDesc(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }} />
                              </div>
                            </div>
                            {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                            {et.is_default && <p className="text-xs text-slate-500 mt-1">The default event type cannot be renamed.</p>}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button onClick={() => handleSaveEdit(et.id)} disabled={editSaving}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1 text-xs mr-2">
                              Save
                            </button>
                            <button onClick={cancelEdit}
                              className="border border-slate-300 rounded px-3 py-1 text-xs hover:bg-slate-50">
                              Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">
                            {et.name}
                            {et.is_default && <span className="ml-2 text-xs text-slate-400">(default)</span>}
                          </td>
                          <td className="px-4 py-2 text-slate-600">{et.description ?? ''}</td>
                          {(canChange || canDelete) && (
                            <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                              {canChange && (
                                <button onClick={() => startEdit(et)}
                                  className="text-blue-600 hover:underline text-xs">Edit</button>
                              )}
                              {canDelete && !et.is_default && (
                                <button onClick={() => handleDelete(et.id, et.name)}
                                  className="text-red-600 hover:underline text-xs">Delete</button>
                              )}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Add new event type */}
        {canCreate && (
          <div className="bg-white/90 rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Add new event type</h2>
            {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}
            <form onSubmit={handleAdd} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input className={`${inputCls} w-full`} name="newName" placeholder="Event type name"
                  value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input className={`${inputCls} w-full`} name="newDesc" placeholder="Optional description"
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <button type="submit" disabled={addSaving || !newName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                {addSaving ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
