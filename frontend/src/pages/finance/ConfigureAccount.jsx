// beacon2/frontend/src/pages/finance/ConfigureAccount.jsx
// Configure Account screen — doc 8.6 sections c, d, e.
// Accessible via the "configure" link on the Finance Accounts list.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const PENDING_OPTIONS = [
  { value: 'disabled', label: 'Disable' },
  { value: 'optional', label: 'Transactions can be marked as pending' },
  { value: 'by_type',  label: 'Select transactions to be pending' },
];

const PAYMENT_TYPES = [
  'Cheque', 'Cash', 'PayPal', 'Standing Order', 'Direct Debit',
  'BACS', 'Debit card', 'Account transfer', 'Credit card',
];

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls   = 'block text-sm font-medium text-slate-700 mb-1';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';

export default function ConfigureAccount() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [account,  setAccount]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const [name,           setName]           = useState('');
  const [pendingConfig,  setPendingConfig]  = useState('disabled');
  const [pendingTypes,   setPendingTypes]   = useState([]);
  const [enableRefunds,  setEnableRefunds]  = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const accounts = await financeApi.listAccounts();
        const acc = accounts.find((a) => a.id === id);
        if (!acc) { setError('Account not found.'); setLoading(false); return; }
        setAccount(acc);
        setName(acc.name);
        setPendingConfig(acc.pending_config ?? 'disabled');
        setPendingTypes(acc.pending_types ?? []);
        setEnableRefunds(acc.enable_refunds ?? false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function toggleType(type) {
    setPendingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { pending_config: pendingConfig, enable_refunds: enableRefunds };
      if (!account.locked) body.name = name.trim() || account.name;
      if (pendingConfig === 'by_type') body.pending_types = pendingTypes;
      await financeApi.configureAccount(id, body);
      navigate('/finance/accounts');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canChange = can('finance_accounts', 'change');
  const navLinks  = [{ label: 'Home', to: '/' }, { label: 'Finance accounts', to: '/finance/accounts' }];

  if (loading) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} /><NavBar links={navLinks} />
      <p className="text-center mt-10 text-slate-500">Loading…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} /><NavBar links={navLinks} />
      <p className="text-center mt-10 text-red-600">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-6">Configure Account</h1>

        <form onSubmit={handleSave} className="bg-white/90 rounded-lg shadow-sm p-6 space-y-5">

          {/* Account name — read-only for locked accounts */}
          <div>
            <label className={labelCls}>Account name</label>
            {account.locked ? (
              <p className="text-sm text-slate-700 px-3 py-2 bg-slate-50 border border-slate-200 rounded">
                {account.name} <span className="text-slate-400 text-xs ml-1">(locked — cannot be renamed)</span>
              </p>
            ) : (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} w-full`}
                disabled={!canChange}
              />
            )}
          </div>

          {/* Pending transactions */}
          <div>
            <label className={labelCls}>Pending transactions</label>
            <select
              value={pendingConfig}
              onChange={(e) => setPendingConfig(e.target.value)}
              className={`${inputCls} w-full`}
              disabled={!canChange}
            >
              {PENDING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {pendingConfig === 'by_type' && (
              <div className="mt-3 border border-slate-200 rounded p-3 grid grid-cols-2 gap-2">
                {PAYMENT_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={pendingTypes.includes(type)}
                      onChange={() => canChange && toggleType(type)}
                      disabled={!canChange}
                      className="w-4 h-4 accent-blue-600"
                    />
                    {type}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Enable refunds */}
          <div>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enableRefunds}
                onChange={(e) => canChange && setEnableRefunds(e.target.checked)}
                disabled={!canChange}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="font-medium">Enable Refunds</span>
            </label>
            <p className="text-xs text-slate-500 mt-1 ml-7">
              Refunds are not shown as income/expenditure in the Financial Statement.
            </p>
          </div>

          {canChange && (
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => navigate('/finance/accounts')}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm transition-colors">
                Cancel
              </button>
            </div>
          )}
          {!canChange && (
            <button type="button" onClick={() => navigate('/finance/accounts')}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm transition-colors">
              Back
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
