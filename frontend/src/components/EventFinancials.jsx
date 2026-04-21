// beacon2/frontend/src/components/EventFinancials.jsx
// Event Financials tab — summary cards + transaction lists for an event.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { calendar } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

function fmtMoney(n) {
  if (n == null) return '—';
  return `£${Number(n).toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export default function EventFinancials({ eventId }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await calendar.getEventFinancials(eventId);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading financials...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return null;

  const cardCls = 'bg-white rounded-lg shadow-sm border p-4 text-center';

  return (
    <div className="space-y-6">
      {/* Header row with ledger button */}
      {can('finance_transactions', 'view') && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/finance/ledger?view=event&eventId=${eventId}`)}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 rounded px-3 py-1.5 text-sm"
          >
            View in Finance Ledger
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cardCls}>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Income</p>
          <p className="text-lg font-bold text-green-700">{fmtMoney(data.totalIncome)}</p>
        </div>
        <div className={cardCls}>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Costs</p>
          <p className="text-lg font-bold text-red-700">{fmtMoney(data.totalCosts)}</p>
        </div>
        <div className={cardCls}>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Net balance</p>
          <p className={`text-lg font-bold ${data.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmtMoney(data.netBalance)}
          </p>
        </div>
        <div className={cardCls}>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Members</p>
          <p className="text-lg font-bold text-slate-700">{data.attendeeCount}</p>
        </div>
      </div>

      {/* Income transactions */}
      <TransactionSection
        title="Income"
        transactions={data.income}
        eventId={eventId}
      />

      {/* Cost transactions */}
      <TransactionSection
        title="Costs"
        transactions={data.costs}
        eventId={eventId}
      />

      {/* Add transaction link */}
      <div>
        <Link
          to={`/finance/transactions/new?eventId=${eventId}`}
          className="text-blue-700 hover:underline text-sm font-medium"
        >
          + Add transaction for this event
        </Link>
      </div>
    </div>
  );
}

function TransactionSection({ title, transactions, eventId }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm">No {title.toLowerCase()} recorded.</p>
      </div>
    );
  }

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap';
  const tdCls = 'px-3 py-2 text-sm text-slate-900 whitespace-nowrap';

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        {title} ({transactions.length})
      </h3>
      <div className="overflow-x-auto rounded-lg shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="bg-slate-50">
            <tr>
              <th className={thCls}>No</th>
              <th className={thCls}>Date</th>
              <th className={thCls}>From/To</th>
              <th className={thCls}>Detail</th>
              <th className={thCls}>Account</th>
              <th className={`${thCls} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className={tdCls}>
                  <Link to={`/finance/transactions/${t.id}`} className="text-blue-700 hover:underline">
                    {t.transaction_number}
                  </Link>
                </td>
                <td className={tdCls}>{fmtDate(t.date)}</td>
                <td className={tdCls}>{t.from_to || ''}</td>
                <td className={`${tdCls} max-w-[200px] truncate`}>{t.detail || ''}</td>
                <td className={tdCls}>{t.account_name || ''}</td>
                <td className={`${tdCls} text-right font-mono`}>{fmtMoney(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
