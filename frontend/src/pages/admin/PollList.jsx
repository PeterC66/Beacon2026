// beacon2/frontend/src/pages/admin/PollList.jsx
// Poll set-up screen — doc 8.8

import { useState, useEffect } from 'react';
import { polls as pollsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const BLANK = { name: '', description: '', memberCanSet: false };

export default function PollList() {
  const { can, tenant } = useAuth();
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // inline edit / create state
  const [editId,   setEditId]   = useState(null);   // null = no edit open, 'new' = add form
  const [form,     setForm]     = useState(BLANK);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState({});

  const navLinks = [{ label: 'Home', to: '/' }];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try { setList(await pollsApi.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function startAdd() {
    setEditId('new');
    setForm(BLANK);
    setFormErr({});
  }

  function startEdit(poll) {
    setEditId(poll.id);
    setForm({ name: poll.name, description: poll.description, memberCanSet: poll.member_can_set });
    setFormErr({});
  }

  function cancelEdit() {
    setEditId(null);
    setFormErr({});
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (form.memberCanSet && !form.description.trim()) errs.description = 'Description is required when members can set this poll.';
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErr(errs); return; }
    setSaving(true);
    setFormErr({});
    try {
      if (editId === 'new') {
        const created = await pollsApi.create({ name: form.name.trim(), description: form.description.trim(), memberCanSet: form.memberCanSet });
        setList((prev) => [...prev, { ...created, member_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const updated = await pollsApi.update(editId, { name: form.name.trim(), description: form.description.trim(), memberCanSet: form.memberCanSet });
        setList((prev) => prev.map((p) => p.id === editId ? { ...p, ...updated } : p));
      }
      setEditId(null);
    } catch (err) {
      if (err.status === 409) setFormErr({ name: 'A poll with that name already exists.' });
      else setError(err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(poll) {
    if (!confirm(`Delete poll "${poll.name}"? This will also remove all member assignments.`)) return;
    try {
      await pollsApi.delete(poll.id);
      setList((prev) => prev.filter((p) => p.id !== poll.id));
      if (editId === poll.id) setEditId(null);
    } catch (err) { setError(err.message); }
  }

  async function handleClearAll(poll) {
    if (!confirm(`Remove all ${poll.member_count} member assignment${poll.member_count !== 1 ? 's' : ''} from "${poll.name}"?`)) return;
    try {
      await pollsApi.clearAll(poll.id);
      setList((prev) => prev.map((p) => p.id === poll.id ? { ...p, member_count: 0 } : p));
    } catch (err) { setError(err.message); }
  }

  const inputCls = 'w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const errCls   = 'w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';

  function renderFormRow(key) { return (
    <tr key={key} className="bg-blue-50 border-b border-slate-200">
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Poll name"
          className={formErr.name ? errCls : inputCls}
          maxLength={100}
          autoFocus
        />
        {formErr.name && <p className="text-sm text-red-600 mt-1">{formErr.name}</p>}
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description"
          className={formErr.description ? errCls : inputCls}
          maxLength={500}
        />
        {formErr.description && <p className="text-sm text-red-600 mt-1">{formErr.description}</p>}
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={form.memberCanSet}
          onChange={(e) => setForm((f) => ({ ...f, memberCanSet: e.target.checked }))}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className="px-3 py-2 text-center">—</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1 text-sm font-medium mr-2">
          {saving ? 'Saving…' : 'Save Poll'}
        </button>
        <button onClick={cancelEdit}
          className="border border-slate-300 rounded px-3 py-1 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </td>
    </tr>
  ); }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Poll Set Up</h1>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg shadow-sm mb-4">
              <table className="w-full text-sm bg-white min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <th className="px-3 py-2.5 font-normal">Name</th>
                    <th className="px-3 py-2.5 font-normal">Description</th>
                    <th className="px-3 py-2.5 font-normal text-center">Member can set</th>
                    <th className="px-3 py-2.5 font-normal text-center">Members</th>
                    <th className="px-3 py-2.5 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((poll, i) => (
                    editId === poll.id ? (
                      renderFormRow(poll.id)
                    ) : (
                      <tr key={poll.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                        <td className="px-3 py-2 font-medium">{poll.name}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[300px] truncate" title={poll.description}>{poll.description}</td>
                        <td className="px-3 py-2 text-center">{poll.member_can_set ? '✓' : ''}</td>
                        <td className="px-3 py-2 text-center">{poll.member_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap space-x-3">
                          {can('poll_set_up', 'change') && (
                            <button onClick={() => startEdit(poll)}
                              className="text-blue-700 hover:underline text-xs">edit</button>
                          )}
                          {can('poll_set_up', 'change') && poll.member_count > 0 && (
                            <button onClick={() => handleClearAll(poll)}
                              className="text-blue-700 hover:underline text-xs">clear all assignments</button>
                          )}
                          {can('poll_set_up', 'delete') && (
                            <button onClick={() => handleDelete(poll)}
                              className="text-red-600 hover:underline text-xs">delete</button>
                          )}
                        </td>
                      </tr>
                    )
                  ))}
                  {editId === 'new' && renderFormRow('new')}
                  {list.length === 0 && editId !== 'new' && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-400 italic">No polls yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {can('poll_set_up', 'create') && editId === null && (
              <button onClick={startAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                Add Poll
              </button>
            )}
          </>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
