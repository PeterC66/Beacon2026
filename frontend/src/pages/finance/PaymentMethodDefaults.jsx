// beacon2/frontend/src/pages/finance/PaymentMethodDefaults.jsx
// Membership Payment Method Defaults — doc 8.6c.
// Sets default payment method and default account for each payment type.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const PAYMENT_METHODS = ['', 'Cheque', 'Cash', 'PayPal', 'Standing Order', 'Direct Debit',
                         'BACS', 'Debit card', 'Account transfer', 'Credit card'];

const inputCls   = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors';

export default function PaymentMethodDefaults() {
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState(null);
  const [accounts,      setAccounts]      = useState([]);
  const [defaultMethod, setDefaultMethod] = useState('');
  const [mappings,      setMappings]      = useState({});  // { paymentMethod: accountId }

  useEffect(() => {
    async function load() {
      try {
        const [accs, defaults] = await Promise.all([
          financeApi.listAccounts(),
          financeApi.getPaymentMethodDefaults(),
        ]);
        setAccounts(accs.filter((a) => a.active));
        setDefaultMethod(defaults.defaultMethod || '');
        setMappings(defaults.mappings || {});
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await financeApi.setPaymentMethodDefaults({ defaultMethod, mappings });
      navigate('/finance/accounts');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function setMapping(method, accountId) {
    setMappings((prev) => ({ ...prev, [method]: accountId }));
  }

  const canChange = can('finance_accounts', 'change');
  const navLinks  = [{ label: 'Home', to: '/' }, { label: 'Finance accounts', to: '/finance/accounts' }];

  if (loading) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} /><NavBar links={navLinks} />
      <p className="text-center mt-10 text-slate-500">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-6">Membership Payment Method Defaults</h1>

        {error && <p className="text-center text-red-600 mb-4">Error: {error}</p>}

        <form onSubmit={handleSave} className="bg-white/90 rounded-lg shadow-sm p-6 space-y-5">

          {/* Default membership payment method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default Membership Payment Method
            </label>
            <select
              name="defaultMethod"
              value={defaultMethod}
              onChange={(e) => setDefaultMethod(e.target.value)}
              className={`${inputCls} w-full`}
              disabled={!canChange}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m || '— none —'}</option>
              ))}
            </select>
          </div>

          {/* Default account by payment type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Account by Payment
            </label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-1.5 pr-4 font-medium">Payment type</th>
                    <th className="py-1.5 font-medium">Default account</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYMENT_METHODS.filter(Boolean).map((method) => (
                    <tr key={method} className="border-b border-slate-100">
                      <td className="py-1.5 pr-4">{method}</td>
                      <td className="py-1.5">
                        <select
                          name={`mapping_${method}`}
                          value={mappings[method] || ''}
                          onChange={(e) => setMapping(method, e.target.value)}
                          className={`${inputCls} w-full`}
                          disabled={!canChange}
                        >
                          <option value="">— none —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      <NavBar links={navLinks} />
    </div>
  );
}
