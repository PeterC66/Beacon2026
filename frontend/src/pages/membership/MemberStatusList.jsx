// beacon2/frontend/src/pages/membership/MemberStatusList.jsx
// Membership statuses — locked system statuses shown read-only;
// custom statuses can be added, edited inline, and deleted.

import { useState, useEffect } from 'react';
import { memberStatuses as api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

export default function MemberStatusList() {
  const { can, tenant } = useAuth();
  const [statuses,  setStatuses]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [newName,   setNewName]   = useState('');
  const [adding,    setAdding]    = useState(false);
  const [editId,    setEditId]    = useState(null);   // id of row being edited inline
  const [editName,  setEditName]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setStatuses(await api.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await api.create({ name: newName.trim() });
      setStatuses((prev) => [...prev, created]);
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(status) {
    setEditId(status.id);
    setEditName(status.name);
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.update(id, { name: editName.trim() });
      setStatuses((prev) => prev.map((s) => s.id === id ? { ...s, name: updated.name } : s));
      setEditId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(status) {
    if (!confirm(`Delete status "${status.name}"? This cannot be undone.`)) return;
    setDeleting(status.id);
    try {
      await api.delete(status.id);
      setStatuses((prev) => prev.filter((s) => s.id !== status.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const navLinks = [{ label: 'Home', to: '/' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Member Statuses</h1>

        {error && <p className="text-red-600 text-sm mb-3 text-center">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500">Loading…</p>
        ) : (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                  <th className="px-4 py-2.5 font-normal">Status name</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((status, i) => (
                  <tr key={status.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                    <td className="px-4 py-2.5">
                      {editId === status.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setEditId(null)}
                          autoFocus
                          className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs"
                        />
                      ) : (
                        <>
                          {status.name}
                          {status.locked && <span className="ml-2 text-xs text-slate-400 italic">locked</span>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {!status.locked && (
                        <>
                          {editId === status.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(status.id)}
                                disabled={saving}
                                className="text-blue-700 hover:underline mr-4 text-sm"
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="text-slate-500 hover:underline text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {can('member_statuses', 'change') && (
                                <button
                                  onClick={() => startEdit(status)}
                                  className="text-blue-700 hover:underline mr-4 text-sm"
                                >
                                  Edit
                                </button>
                              )}
                              {can('member_statuses', 'delete') && (
                                <button
                                  onClick={() => handleDelete(status)}
                                  disabled={deleting === status.id}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  {deleting === status.id ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {can('member_statuses', 'create') && (
              <form onSubmit={handleAdd} className="px-4 py-3 border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Add new status…"
                  maxLength={100}
                  className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={adding || !newName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
                >
                  {adding ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
