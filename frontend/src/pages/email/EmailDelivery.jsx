// beacon2/frontend/src/pages/email/EmailDelivery.jsx
// List of email batches sent by the current user.

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { email as emailApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';

function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function EmailDelivery() {
  const { tenant } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const tableRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await emailApi.listDelivery({ from: from || undefined, to: to || undefined });
      setBatches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const navLinks = [{ label: 'Home', to: '/' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Email Delivery</h1>

        {/* Date filter */}
        <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={load} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm">Search</button>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {loading ? (
          <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No emails found.</p>
        ) : (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto" ref={tableRef}>
              <table className="min-w-max w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-700">Sent</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-700">Subject</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-700">From</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-700">Recipients</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b, i) => (
                    <tr key={b.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(b.sent_at)}</td>
                      <td className="px-4 py-2">{b.subject}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{b.from_email}</td>
                      <td className="px-4 py-2 text-right">{b.recipient_count}</td>
                      <td className="px-4 py-2">
                        <Link to={`/email/delivery/${b.id}`} className="text-blue-700 hover:underline text-xs">View status</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
