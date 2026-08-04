// beacon2026/frontend/src/pages/settings/StandardMessages.jsx
// Admin CRUD for org-wide (unowned) standard emails and standard letters —
// the sole place these can be created, edited or deleted, now that the
// compose-screen "Save as standard" buttons have been removed (see
// UX-Improvements-Plan item #1). Group/team-owned templates are managed
// instead from the group/team's own Std Emails/Std Letters tabs
// (StdEmailsTab.jsx / StdLettersTab.jsx).
//
// The GET endpoints return every template (owned and unowned); this page
// filters to owner_group_id == null and always saves with ownerGroupId: null.

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { email as emailApi, letters as lettersApi } from '../../lib/api.js';
import { textToTiptapDoc, tiptapDocToText } from '../../lib/simpleTiptapDoc.js';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { inputCls, labelCls } from '../../components/ui/Input.jsx';

const navLinks = [{ label: 'Home', to: '/' }];

function StdEmailsSection() {
  const { can } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const canManage = can('email_standard_messages_all', 'create');
  const canDelete = can('email_standard_messages_all', 'delete');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const all = await emailApi.listStandardMessages();
      setMessages(all.filter((m) => m.owner_group_id == null));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(msg) {
    setEditingId(msg.id);
    let text = '';
    try {
      text = tiptapDocToText(JSON.parse(msg.body));
    } catch {
      text = '';
    }
    setForm({ name: msg.name, subject: msg.subject ?? '', body: text });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: '', subject: '', body: '' });
    setSaveError(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await emailApi.saveStandardMessage({
        name: form.name.trim(),
        subject: form.subject,
        body: JSON.stringify(textToTiptapDoc(form.body)),
        ownerGroupId: null,
      });
      cancelEdit();
      await load();
    } catch (err) {
      setSaveError(err.body?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete standard email "${name}"?`)) return;
    try {
      await emailApi.deleteStandardMessage(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4 mb-6">
      <h2 className="text-lg font-semibold mb-1">Std Emails</h2>
      <p className="text-xs text-slate-600 mb-3">
        Org-wide standard email messages, available to everyone composing an email. Group/team-owned
        templates are managed from the group or team's own Std Emails tab instead. Editing here is
        plain text only — bold/italic/underline formatting from the full email editor is not
        preserved if you save changes here.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-slate-500 text-sm mb-4">No org-wide standard emails yet.</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  Name
                </th>
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  Subject
                </th>
                {(canManage || canDelete) && (
                  <th className="px-3 py-2 border-b border-slate-200"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {messages.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                  <td className="px-3 py-1.5 border-b border-slate-100">{m.name}</td>
                  <td className="px-3 py-1.5 border-b border-slate-100">{m.subject}</td>
                  {(canManage || canDelete) && (
                    <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                      {canManage && (
                        <button
                          onClick={() => startEdit(m)}
                          className="text-blue-600 hover:underline text-sm mr-3"
                        >
                          edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <form onSubmit={handleSave} className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {editingId ? 'Edit Std Email' : 'Add Std Email'}
          </h3>
          {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-40">
              <label htmlFor="std-email-name" className={labelCls}>
                Name
              </label>
              <input
                id="std-email-name"
                className={`${inputCls} w-full`}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                disabled={!!editingId}
              />
            </div>
            <div className="flex-1 min-w-40">
              <label htmlFor="std-email-subject" className={labelCls}>
                Subject
              </label>
              <input
                id="std-email-subject"
                className={`${inputCls} w-full`}
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-3">
            <label htmlFor="std-email-body" className={labelCls}>
              Message body (one paragraph per line)
            </label>
            <textarea
              id="std-email-body"
              rows={8}
              className={`${inputCls} w-full font-mono text-xs`}
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-2 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function StdLettersSection() {
  const { can } = useAuth();
  const [letterList, setLetterList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ name: '', body: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const canManage = can('letters_standard_messages_all', 'create');
  const canDelete = can('letters_standard_messages_all', 'delete');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const all = await lettersApi.listStandardLetters();
      setLetterList(all.filter((l) => l.owner_group_id == null));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(letter) {
    setEditingId(letter.id);
    let text = '';
    try {
      text = tiptapDocToText(JSON.parse(letter.body));
    } catch {
      text = '';
    }
    setForm({ name: letter.name, body: text });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: '', body: '' });
    setSaveError(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await lettersApi.saveStandardLetter({
        name: form.name.trim(),
        body: JSON.stringify(textToTiptapDoc(form.body)),
        ownerGroupId: null,
      });
      cancelEdit();
      await load();
    } catch (err) {
      setSaveError(err.body?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete standard letter "${name}"?`)) return;
    try {
      await lettersApi.deleteStandardLetter(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-white/90 rounded-lg shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-1">Std Letters</h2>
      <p className="text-xs text-slate-600 mb-3">
        Org-wide standard letters, available to everyone composing a letter. Group/team-owned
        templates are managed from the group or team's own Std Letters tab instead. Editing here is
        plain text only — bold/italic/underline formatting from the full letter editor is not
        preserved if you save changes here.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : letterList.length === 0 ? (
        <p className="text-slate-500 text-sm mb-4">No org-wide standard letters yet.</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-700 border-b border-slate-200">
                  Name
                </th>
                {(canManage || canDelete) && (
                  <th className="px-3 py-2 border-b border-slate-200"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {letterList.map((l, i) => (
                <tr key={l.id} className={i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}>
                  <td className="px-3 py-1.5 border-b border-slate-100">{l.name}</td>
                  {(canManage || canDelete) && (
                    <td className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap">
                      {canManage && (
                        <button
                          onClick={() => startEdit(l)}
                          className="text-blue-600 hover:underline text-sm mr-3"
                        >
                          edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(l.id, l.name)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <form onSubmit={handleSave} className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {editingId ? 'Edit Std Letter' : 'Add Std Letter'}
          </h3>
          {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
          <div className="mb-3">
            <label htmlFor="std-letter-name" className={labelCls}>
              Name
            </label>
            <input
              id="std-letter-name"
              className={`${inputCls} w-full`}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={!!editingId}
            />
          </div>
          <div className="mb-3">
            <label htmlFor="std-letter-body" className={labelCls}>
              Letter body (one paragraph per line)
            </label>
            <textarea
              id="std-letter-body"
              rows={10}
              className={`${inputCls} w-full font-mono text-xs`}
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-4 py-2 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function StandardMessages() {
  const { can, hasFeature, tenant } = useAuth();

  const showEmails = hasFeature('email') && can('email_standard_messages_all', 'view');
  const showLetters = hasFeature('letters') && can('letters_standard_messages_all', 'view');

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Standard Emails &amp; Letters</h1>

        {!showEmails && !showLetters ? (
          <p className="text-center text-slate-500 py-8">You do not have access to this page.</p>
        ) : (
          <>
            {showEmails && <StdEmailsSection />}
            {showLetters && <StdLettersSection />}
          </>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
