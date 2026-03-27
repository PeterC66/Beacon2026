// beacon2/frontend/src/pages/settings/SystemMessages.jsx
// Admin page for viewing and editing system message templates.

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { systemMessages as api } from '../../lib/api.js';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';

export default function SystemMessages() {
  const { tenant, can } = useAuth();
  const [messages, setMessages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => {
    api.list().then(setMessages).catch((e) => setError(e.message));
  }, []);

  function startEdit(msg) {
    setEditing(msg.id);
    setForm({ subject: msg.subject, body: msg.body });
    setError('');
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ subject: '', body: '' });
  }

  async function saveEdit(id) {
    try {
      setError('');
      const updated = await api.update(id, form);
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditing(null);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    }
  }

  const canChange = can('system_messages', 'change');

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={[{ to: '/', label: 'Home' }, { label: 'System Messages' }]} />

      <div className="max-w-4xl mx-auto px-4 mt-4">
        <h1 className="text-xl font-bold mb-4">System Messages</h1>
        <p className="text-sm text-slate-600 mb-4">
          These templates are used for emails sent automatically by the system (e.g. online joining confirmation).
          You can use tokens like #FORENAME, #SURNAME, #MEMNO, #MEMCLASS, #U3ANAME, #EMAIL in the subject and body.
        </p>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        {saved && (
          <div className="rounded-md bg-green-50 border border-green-300 px-4 py-3 text-green-700 text-sm font-medium text-center mb-4">
            Message saved successfully.
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-sm">{msg.name}</h2>
                {canChange && editing !== msg.id && (
                  <button
                    onClick={() => startEdit(msg)}
                    className="text-blue-700 hover:underline text-sm"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing === msg.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <input
                      type="text"
                      name="subject"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
                    <textarea
                      name="body"
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      rows={8}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(msg.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="border border-slate-300 text-slate-600 hover:bg-slate-50 rounded px-5 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-slate-600 mb-1">
                    <span className="font-medium">Subject:</span> {msg.subject}
                  </div>
                  <pre className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-3 mt-1">
                    {msg.body}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {messages.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No system messages configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}
