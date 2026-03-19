// beacon2/frontend/src/pages/email/EmailDeliveryDetail.jsx
// Detailed delivery status for a single email batch.

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { email as emailApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const STATUS_COLOURS = {
  'Despatched':       'text-blue-600',
  'Processed':        'text-blue-500',
  'Delivered':        'text-green-600',
  'Deferred':         'text-amber-600',
  'Bounced':          'text-red-600',
  'Blocked':          'text-orange-600',
  'Dropped':          'text-red-700',
  'Invalid':          'text-red-500',
  'Reported as SPAM': 'text-red-800',
};

function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function EmailDeliveryDetail() {
  const { id } = useParams();
  const { tenant } = useAuth();
  const [batch,      setBatch]      = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await emailApi.getDelivery(id);
      setBatch(data.batch);
      setRecipients(data.recipients);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const data = await emailApi.refreshDelivery(id);
      setRecipients(data.recipients);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Email Delivery', to: '/email/delivery' },
  ];

  if (loading) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Email Delivery Detail</h1>
        <p className="text-center text-slate-500 py-8">Loading…</p>
      </div>
    </div>
  );

  if (error && !batch) return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />
      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Email Delivery Detail</h1>
        <p className="text-center text-red-600 py-8">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Email Delivery Detail</h1>

        {batch && (
          <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-4 text-sm space-y-1">
            <div><span className="font-medium">Sent:</span> {fmtDateTime(batch.sent_at)}</div>
            <div><span className="font-medium">Subject:</span> {batch.subject}</div>
            <div><span className="font-medium">From:</span> {batch.from_email}</div>
            <div><span className="font-medium">Reply-To:</span> {batch.reply_to}</div>
            <div><span className="font-medium">Recipients:</span> {batch.recipient_count}</div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-slate-600">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh statuses from SendGrid'}
          </button>
        </div>

        <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-700">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-700">Email address</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-700">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-700">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipients.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                    <td className="px-4 py-2">
                      {r.member_id
                        ? <Link to={`/members/${r.member_id}`} className="text-blue-700 hover:underline">{r.display_name}</Link>
                        : r.display_name}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.email_address}</td>
                    <td className={`px-4 py-2 font-medium ${STATUS_COLOURS[r.status] || 'text-slate-700'}`}>
                      {r.status}
                      {r.error_message && <span className="text-xs text-red-500 ml-2">({r.error_message})</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">{fmtDateTime(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
