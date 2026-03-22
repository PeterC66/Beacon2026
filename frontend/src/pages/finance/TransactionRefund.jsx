// beacon2/frontend/src/pages/finance/TransactionRefund.jsx
// Refund form for a transaction — implements Beacon doc 7.10.7.

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { finance as financeApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import DateInput from '../../components/DateInput.jsx';

const PAYMENT_METHODS = ['', 'Cheque', 'Cash', 'PayPal', 'Standing Order', 'Direct Debit',
                         'BACS', 'Debit card', 'Account transfer', 'Credit card'];

const today = () => new Date().toISOString().slice(0, 10);

export default function TransactionRefund() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();

  const [orig,       setOrig]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [date,       setDate]       = useState(today());
  const [payMethod,  setPayMethod]  = useState('');
  const [payRef,     setPayRef]     = useState('');
  const [detail,     setDetail]     = useState('');
  const [remarks,    setRemarks]    = useState('');
  const [refAmounts, setRefAmounts] = useState({}); // { category_id: string_amount }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const t = await financeApi.getTransaction(id);
        setOrig(t);
        // Initialise refund amounts to empty for each category
        const amounts = {};
        if (Array.isArray(t.categories)) {
          t.categories.forEach((c) => { amounts[c.category_id] = ''; });
        }
        setRefAmounts(amounts);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  const refundTotal = useMemo(() => {
    return Object.values(refAmounts).reduce((s, v) => {
      const n = parseFloat(v);
      return s + (isNaN(n) ? 0 : n);
    }, 0);
  }, [refAmounts]);

  const refundOk = refundTotal > 0 && orig && refundTotal <= orig.amount + 0.001;

  function validate() {
    if (!date) return 'Please enter a date.';
    if (refundTotal <= 0) return 'Please enter a refund amount for at least one category.';
    if (orig && refundTotal > orig.amount + 0.001) return `Refund total (${refundTotal.toFixed(2)}) cannot exceed original amount (${orig.amount.toFixed(2)}).`;
    // Per-category validation
    if (orig && Array.isArray(orig.categories)) {
      for (const cat of orig.categories) {
        const refAmt = parseFloat(refAmounts[cat.category_id] || '0');
        if (refAmt > cat.amount + 0.001) {
          return `Refund for "${cat.name}" (${refAmt.toFixed(2)}) exceeds original (${cat.amount.toFixed(2)}).`;
        }
      }
    }
    return null;
  }

  async function handleSave(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const categories = Object.entries(refAmounts)
        .map(([category_id, v]) => ({ category_id, amount: parseFloat(v) || 0 }))
        .filter((c) => c.amount > 0);

      const result = await financeApi.refundTransaction(id, {
        date,
        payment_method: payMethod || null,
        payment_ref: payRef || null,
        detail: detail || null,
        remarks: remarks || null,
        categories,
      });
      navigate(`/finance/transactions/${result.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Ledger', to: '/finance/ledger' },
    ...(orig ? [{ label: `Transaction #${orig.transaction_number}`, to: `/finance/transactions/${id}` }] : []),
  ];

  const INP = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
  const LBL = 'block text-sm font-medium text-slate-700 mb-1';

  if (loading) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <p className="text-center text-slate-500 py-12">Loading...</p>
      </div>
    );
  }

  if (!orig) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <p className="text-center text-red-600 py-12">Transaction not found.</p>
      </div>
    );
  }

  const refundTypeLabel = orig.type === 'in' ? 'Repayment of money received' : 'Refund of payment';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Transaction Refund</h1>

        {error && <p className="text-center text-red-600 py-2 mb-2">Error: {error}</p>}

        {/* Original transaction info */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Original Transaction</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Type:</span>{' '}
              <span className="font-medium">{orig.type === 'in' ? 'Money received' : 'Payment'}</span>
            </div>
            <div>
              <span className="text-slate-500">Transaction #:</span>{' '}
              <span className="font-medium">{orig.transaction_number}</span>
            </div>
            <div>
              <span className="text-slate-500">{orig.type === 'in' ? 'From' : 'To'}:</span>{' '}
              <span className="font-medium">{orig.from_to || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Amount:</span>{' '}
              <span className="font-medium">£{Number(orig.amount).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">Date:</span>{' '}
              <span className="font-medium">{new Date(orig.date).toLocaleDateString('en-GB')}</span>
            </div>
            <div>
              <span className="text-slate-500">Account:</span>{' '}
              <span className="font-medium">{orig.account_name}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
            {/* Refund type (read-only) */}
            <div className="sm:col-span-2">
              <label className={LBL}>Transaction type</label>
              <p className="text-sm font-medium text-slate-700 bg-slate-50 rounded px-3 py-2">{refundTypeLabel}</p>
            </div>

            {/* Date */}
            <div>
              <label className={LBL}>Refund date *</label>
              <DateInput value={date} onChange={setDate} className={INP} />
            </div>

            {/* Total refund amount (computed) */}
            <div>
              <label className={LBL}>Refund amount (£)</label>
              <p className={`font-mono text-sm px-3 py-2 rounded ${refundOk ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-700'}`}>
                £{refundTotal.toFixed(2)}
              </p>
            </div>

            {/* Payment method */}
            <div>
              <label className={LBL}>Payment method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={INP}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m || '— none —'}</option>)}
              </select>
            </div>

            {/* Payment reference */}
            <div>
              <label className={LBL}>Payment reference</label>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className={INP} placeholder="Reference" />
            </div>

            {/* Detail */}
            <div className="sm:col-span-2">
              <label className={LBL}>Detail</label>
              <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)} className={INP} placeholder="Reason for refund" />
            </div>

            {/* Remarks */}
            <div className="sm:col-span-2">
              <label className={LBL}>Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={INP} placeholder="Additional notes" />
            </div>
          </div>

          {/* Category refund amounts */}
          <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Refund by category</h2>
            <p className="text-xs text-slate-500 mb-3">
              Enter refund amount per category. Each must be ≤ the original category amount.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-1.5 pr-4 font-medium">Category</th>
                    <th className="py-1.5 w-28 font-medium text-right">Original (£)</th>
                    <th className="py-1.5 w-36 font-medium">Refund (£)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(orig.categories) && orig.categories.map((cat) => (
                    <tr key={cat.category_id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-4">{cat.name}</td>
                      <td className="py-1.5 text-right font-mono">{Number(cat.amount).toFixed(2)}</td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min="0"
                          max={cat.amount}
                          step="0.01"
                          value={refAmounts[cat.category_id] ?? ''}
                          onChange={(e) => setRefAmounts((prev) => ({ ...prev, [cat.category_id]: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-medium">
                    <td className="py-1.5 pr-4">Total</td>
                    <td className="py-1.5 text-right font-mono">£{Number(orig.amount).toFixed(2)}</td>
                    <td className="py-1.5 font-mono px-2">£{refundTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="submit"
              disabled={saving || !refundOk}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-6 py-2 text-sm font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/finance/transactions/${id}`)}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-6 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
