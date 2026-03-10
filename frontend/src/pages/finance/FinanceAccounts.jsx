// beacon2/frontend/src/pages/finance/FinanceAccounts.jsx
// Finance accounts management — 8.6 Finance Set-up, section 1.

import { useState, useEffect } from 'react';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const inputCls  = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors';
const btnSmall   = 'border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-3 py-1 text-xs transition-colors';
const btnDanger  = 'border border-red-300 text-red-600 hover:bg-red-50 rounded px-3 py-1 text-xs transition-colors';

export default function FinanceAccounts() {
  const { can, tenant } = useAuth();
  const [accounts, setAccounts]     = useState([]);
  const [loading,  setLoading]      = useState(true);
  const [error,    setError]        = useState(null);
  const [newName,  setNewName]      = useState('');
  const [adding,   setAdding]       = useState(false);
  const [editId,   setEditId]       = useState(null);
  const [editName, setEditName]     = useState('');
  const [saving,   setSaving]       = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setAccounts(await financeApi.listAccounts()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const row = await financeApi.createAccount({ name: newName.trim() });
      setAccounts((prev) => [...prev, row]);
      setNewName('');
    } catch (err) { alert(err.message); }
    finally { setAdding(false); }
  }

  async function handleToggleActive(acc) {
    if (acc.locked) return;
    try {
      const updated = await financeApi.updateAccount(acc.id, { active: !acc.active });
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, ...updated } : a));
    } catch (err) { alert(err.message); }
  }

  async function handleSaveName(acc) {
    if (!editName.trim() || editName.trim() === acc.name) { setEditId(null); return; }
    setSaving(true);
    try {
      const updated = await financeApi.updateAccount(acc.id, { name: editName.trim() });
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, ...updated } : a));
      setEditId(null);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(acc) {
    if (!confirm(`Delete account "${acc.name}"?`)) return;
    try {
      await financeApi.deleteAccount(acc.id);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (err) { alert(err.message); }
  }

  const canChange = can('finance_accounts', 'change');
  const canCreate = can('finance_accounts', 'create');
  const canDelete = can('finance_accounts', 'delete');
  const navLinks  = [{ label: 'Home', to: '/' }, { label: 'Finance categories', to: '/finance/categories' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Finance Accounts</h1>
        <p className="text-sm text-slate-500 text-center mb-5">
          Each account corresponds to a bank account, PayPal account, cash or similar.
        </p>

        {loading && <p className="text-center text-slate-500">Loading…</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {!loading && !error && (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                  <th className="px-4 py-2.5 font-normal">Account name</th>
                  <th className="px-4 py-2.5 font-normal text-center">Active</th>
                  {(canChange || canDelete) && <th className="px-4 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400">No accounts yet.</td></tr>
                )}
                {accounts.map((acc, i) => (
                  <tr key={acc.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                    <td className="px-4 py-2.5">
                      {editId === acc.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(acc); if (e.key === 'Escape') setEditId(null); }}
                          className={`${inputCls} w-full`}
                          autoFocus
                        />
                      ) : (
                        <span className={acc.active ? '' : 'text-slate-400 line-through'}>{acc.name}</span>
                      )}
                      {acc.locked && <span className="ml-2 text-xs text-slate-400">(locked)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={acc.active}
                        onChange={() => canChange && !acc.locked && handleToggleActive(acc)}
                        disabled={!canChange || acc.locked}
                        className="w-4 h-4 accent-blue-600"
                      />
                    </td>
                    {(canChange || canDelete) && (
                      <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                        {canChange && !acc.locked && editId !== acc.id && (
                          <button onClick={() => { setEditId(acc.id); setEditName(acc.name); }} className={btnSmall}>
                            Rename
                          </button>
                        )}
                        {editId === acc.id && (
                          <>
                            <button onClick={() => handleSaveName(acc)} disabled={saving} className={btnPrimary}>Save</button>
                            <button onClick={() => setEditId(null)} className={btnSmall}>Cancel</button>
                          </>
                        )}
                        {canDelete && !acc.locked && editId !== acc.id && (
                          <button onClick={() => handleDelete(acc)} className={btnDanger}>Delete</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canCreate && (
          <form onSubmit={handleAdd} className="mt-5 flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Add new account</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Account name"
                className={`${inputCls} w-full`}
              />
            </div>
            <button type="submit" disabled={adding || !newName.trim()} className={btnPrimary}>
              {adding ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
