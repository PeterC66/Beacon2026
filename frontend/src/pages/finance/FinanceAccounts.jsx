// beacon2/frontend/src/pages/finance/FinanceAccounts.jsx
// Finance accounts management — 8.6 Finance Set-up, section 1.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [accounts,  setAccounts]    = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [error,     setError]       = useState(null);
  const [newName,   setNewName]     = useState('');
  const [adding,    setAdding]      = useState(false);
  const [editBF,    setEditBF]      = useState({});    // { accountId: '123.45' }
  const [savingBF,  setSavingBF]    = useState(null);  // accountId being saved
  const [groupBf,   setGroupBf]     = useState(false); // Group B/F tickbox

  useEffect(() => { load(); loadGroupBf(); }, []);

  async function load() {
    setLoading(true);
    try { setAccounts(await financeApi.listAccounts()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function loadGroupBf() {
    try {
      const data = await financeApi.getGroupBfSetting();
      setGroupBf(data.groupBfEnabled);
    } catch { /* ignore — setting may not exist yet */ }
  }

  async function handleToggleGroupBf() {
    const next = !groupBf;
    try {
      const data = await financeApi.setGroupBfSetting(next);
      setGroupBf(data.groupBfEnabled);
    } catch (err) { alert(err.message); }
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

  async function handleSaveBF(acc) {
    const val = parseFloat(editBF[acc.id]);
    if (isNaN(val)) return;
    setSavingBF(acc.id);
    try {
      const updated = await financeApi.updateAccount(acc.id, { balance_brought_forward: val });
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, ...updated } : a));
      setEditBF((prev) => { const n = { ...prev }; delete n[acc.id]; return n; });
    } catch (err) { alert(err.message); }
    finally { setSavingBF(null); }
  }

  async function handleDelete(acc) {
    if (!confirm(`Delete account "${acc.name}"?`)) return;
    try {
      await financeApi.deleteAccount(acc.id);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (err) { alert(err.message); }
  }

  const navigate  = useNavigate();
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

        {!loading && !error && (
          <p className="text-right mb-3">
            <Link to="/finance/payment-method-defaults" className="text-sm text-blue-600 hover:underline">
              Membership Payment Method Defaults
            </Link>
          </p>
        )}

        {loading && <p className="text-center text-slate-500">Loading…</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {!loading && !error && (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                  <th className="px-4 py-2.5 font-normal">Account</th>
                  <th className="px-4 py-2.5 font-normal text-center">Active</th>
                  <th className="px-4 py-2.5 font-normal text-right">Balance b/f (£)</th>
                  <th className="px-4 py-2.5"></th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">No accounts yet.</td></tr>
                )}
                {accounts.map((acc, i) => (
                  <tr key={acc.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                    <td className="px-4 py-2.5">
                      <span className={acc.active ? '' : 'text-slate-400 line-through'}>{acc.name}</span>
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
                    <td className="px-4 py-2.5 text-right">
                      {canChange ? (
                        editBF[acc.id] !== undefined ? (
                          <span className="flex items-center justify-end gap-1">
                            <input type="number" step="0.01"
                              name={`broughtForward_${acc.id}`}
                              value={editBF[acc.id]}
                              onChange={(e) => setEditBF((prev) => ({ ...prev, [acc.id]: e.target.value }))}
                              className="border border-slate-300 rounded px-2 py-0.5 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={() => handleSaveBF(acc)} disabled={savingBF === acc.id}
                              className="text-xs text-blue-600 hover:underline">save</button>
                            <button onClick={() => setEditBF((p) => { const n={...p}; delete n[acc.id]; return n; })}
                              className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                          </span>
                        ) : (
                          <button onClick={() => setEditBF((p) => ({ ...p, [acc.id]: String(acc.balance_brought_forward ?? 0) }))}
                            className="font-mono text-sm text-slate-700 hover:underline">
                            {Number(acc.balance_brought_forward ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </button>
                        )
                      ) : (
                        <span className="font-mono text-sm">
                          {Number(acc.balance_brought_forward ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canChange && (
                        <Link to={`/finance/accounts/${acc.id}/configure`}
                          className="text-blue-600 hover:underline text-sm">
                          configure
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {acc.locked ? (
                        <span className="text-xs text-slate-400">locked</span>
                      ) : (
                        canDelete && (
                          <button onClick={() => handleDelete(acc)} className={btnDanger}>
                            delete
                          </button>
                        )
                      )}
                    </td>
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
                name="newName"
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

        {!loading && !error && (
          <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={groupBf}
              onChange={handleToggleGroupBf}
              disabled={!canChange}
              className="w-4 h-4 accent-blue-600"
            />
            Display Group brought forward balances at the start of the financial year
          </label>
        )}

        {!loading && !error && (
          <p className="text-right mt-3">
            <Link to="/finance/payment-method-defaults" className="text-sm text-blue-600 hover:underline">
              Membership Payment Method Defaults
            </Link>
          </p>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
