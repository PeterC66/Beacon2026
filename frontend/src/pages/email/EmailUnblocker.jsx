// beacon2/frontend/src/pages/email/EmailUnblocker.jsx
// Allows the Site Administrator to remove an email address from
// SendGrid's bounce and spam report lists.

import { useState } from 'react';
import { email as emailApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

export default function EmailUnblocker() {
  const { tenant } = useAuth();
  const [emailAddr, setEmailAddr] = useState('');
  const [working,   setWorking]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);

  async function handleUnblock(e) {
    e.preventDefault();
    if (!emailAddr.trim()) return;
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      const data = await emailApi.unblock(emailAddr.trim());
      setResult(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  const navLinks = [{ label: 'Home', to: '/' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-center mb-6">Email Unblocker</h1>

        <div className="bg-white/90 rounded-lg shadow-sm p-6">
          <p className="text-sm text-slate-600 mb-4">
            This utility removes an email address from SendGrid's bounce and spam report lists,
            allowing future emails to be delivered to that address.
          </p>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
            <strong>Note:</strong> Only use this if you have confirmed the email address is valid
            and the owner has indicated it can be unblocked. Copy/paste the address to avoid typing errors.
          </p>

          <form onSubmit={handleUnblock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address to unblock</label>
              <input
                type="email"
                value={emailAddr}
                onChange={(e) => setEmailAddr(e.target.value)}
                placeholder="member@example.com"
                required
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}
            {result && (
              <div className="bg-green-50 border border-green-200 rounded px-4 py-3 text-green-700 text-sm">
                {result}
              </div>
            )}

            <button
              type="submit"
              disabled={working || !emailAddr.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
            >
              {working ? 'Unblocking…' : 'Unblock email address'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
