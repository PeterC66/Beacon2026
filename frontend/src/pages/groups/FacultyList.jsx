// beacon2/frontend/src/pages/groups/FacultyList.jsx
// Manage group faculties (5.8)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { faculties as facultiesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

export default function FacultyList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Inline edit state
  const [editingId,   setEditingId]   = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editError,   setEditError]   = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);

  // Add new faculty
  const [newName,   setNewName]   = useState('');
  const [addError,  setAddError]  = useState(null);
  const [addSaving, setAddSaving] = useState(false);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(list, 'name');

  const canChange = can('group_faculties', 'change');
  const canCreate = can('group_faculties', 'create');
  const canDelete = can('group_faculties', 'delete');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await facultiesApi.list();
      setList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(f) {
    setEditingId(f.id);
    setEditingName(f.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
    setEditError(null);
  }

  async function handleSaveEdit(id) {
    if (!editingName.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await facultiesApi.update(id, { name: editingName.trim() });
      setList((prev) => prev.map((f) => f.id === id ? { ...f, name: updated.name } : f));
      cancelEdit();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete faculty "${name}"? Groups assigned to it will become unassigned.`)) return;
    try {
      await facultiesApi.delete(id);
      setList((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const created = await facultiesApi.create({ name: newName.trim() });
      setList((prev) => [...prev, created]);
      setNewName('');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  const navLinks = [
    { label: 'Home',   to: '/' },
    { label: 'Groups', to: '/groups' },
  ];

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Group Faculties</h1>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-x-auto mb-6">
            {sorted.length === 0 ? (
              <p className="text-slate-500 text-sm p-4">No faculties yet. Add one below.</p>
            ) : (
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <SortableHeader col="name" label="Faculty Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
                    {(canChange || canDelete) && <th className="px-4 py-2.5 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((f, i) => (
                    <tr key={f.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      <td className="px-4 py-2">
                        {editingId === f.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              className={`${inputCls} flex-1`}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(f.id);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            {editError && <span className="text-red-600 text-xs">{editError}</span>}
                            <button
                              onClick={() => handleSaveEdit(f.id)}
                              disabled={editSaving}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1 text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="border border-slate-300 rounded px-3 py-1 text-xs hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          f.name
                        )}
                      </td>
                      {(canChange || canDelete) && (
                        <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                          {canChange && editingId !== f.id && (
                            <button
                              onClick={() => startEdit(f)}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(f.id, f.name)}
                              className="text-red-600 hover:underline text-xs"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Add new faculty */}
        {canCreate && (
          <div className="bg-white/90 rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Add new faculty</h2>
            {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder="Faculty name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={addSaving || !newName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
              >
                {addSaving ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
