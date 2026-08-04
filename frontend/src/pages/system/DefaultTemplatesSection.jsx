// beacon2026/frontend/src/pages/system/DefaultTemplatesSection.jsx
//
// "Default Standard Emails & Letters" section of SystemDashboard. System
// Admin's own CRUD library for the templates seeded into every newly-created
// tenant (seed/createTenant.js reads these same master tables). Each
// template also has a "Roll out" button that pushes it into every existing
// tenant that does not already have one of that name — see item 11 of
// docs/UX-Improvements-Plan-2026-08-04.md.
//
// Editing is plain text (one paragraph per line, letters stored as a minimal
// Tiptap doc under the hood), the same simplification already used by the
// tenant-scoped Std Emails/Letters screens (StdEmailsTab.jsx,
// pages/settings/StandardMessages.jsx) — this screen has no rich-text editor.

import { useState, useEffect } from 'react';
import { system, getSysToken } from '../../lib/api.js';
import { textToTiptapDoc, tiptapDocToText } from '../../lib/simpleTiptapDoc.js';

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

function RolloutResult({ result }) {
  if (!result) return null;
  const created = result.results.filter((r) => r.created);
  const skipped = result.results.filter((r) => !r.created);
  return (
    <div className="mt-2 text-xs text-slate-600">
      {created.length > 0 ? (
        <p>Created in: {created.map((r) => r.name).join(', ')}</p>
      ) : (
        <p>Already present in every active tenant — nothing to roll out.</p>
      )}
      {skipped.length > 0 && <p>Already had it: {skipped.map((r) => r.name).join(', ')}</p>}
    </div>
  );
}

function MessagesSubsection() {
  const token = getSysToken();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [rolloutId, setRolloutId] = useState(null);
  const [rolloutResult, setRolloutResult] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await system.listDefaultMessages(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({ name: item.name, subject: item.subject ?? '', body: item.body });
    setSaveError(null);
    setRolloutResult(null);
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
      const data = { name: form.name.trim(), subject: form.subject, body: form.body };
      if (editingId) {
        await system.updateDefaultMessage(token, editingId, data);
      } else {
        await system.createDefaultMessage(token, data);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete default standard email "${name}"?`)) return;
    try {
      await system.deleteDefaultMessage(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRollout(id) {
    setRolloutId(id);
    setRolloutResult(null);
    setError(null);
    try {
      const result = await system.rolloutDefaultMessage(token, id);
      setRolloutResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setRolloutId(null);
    }
  }

  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-slate-700 mb-1">Default Standard Emails</h3>
      <p className="text-sm text-slate-500 mb-3">
        Seeded into every newly-created tenant. Use "Roll out" to push a template into every
        existing tenant that doesn't already have one of that name.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-400 text-sm mb-3">No default standard emails yet.</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 align-top">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.subject}</td>
                  <td className="py-2 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRollout(item.id)}
                      disabled={rolloutId === item.id}
                      className="text-xs text-emerald-600 hover:text-emerald-800 underline disabled:text-slate-400"
                    >
                      {rolloutId === item.id ? 'Rolling out…' : 'Roll out'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                      Delete
                    </button>
                    {rolloutResult && rolloutResult.template === item.name && (
                      <RolloutResult result={rolloutResult} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleSave} className="border-t border-slate-200 pt-4 max-w-xl">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          {editingId ? 'Edit default standard email' : 'Add default standard email'}
        </h4>
        {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
        <div className="mb-3">
          <label htmlFor="def-msg-name" className={labelCls}>
            Name
          </label>
          <input
            id="def-msg-name"
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            disabled={!!editingId}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="def-msg-subject" className={labelCls}>
            Subject
          </label>
          <input
            id="def-msg-subject"
            className={inputCls}
            value={form.subject}
            onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="def-msg-body" className={labelCls}>
            Message body
          </label>
          <textarea
            id="def-msg-body"
            rows={8}
            className={`${inputCls} font-mono text-xs`}
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function LettersSubsection() {
  const token = getSysToken();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ name: '', body: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [rolloutId, setRolloutId] = useState(null);
  const [rolloutResult, setRolloutResult] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await system.listDefaultLetters(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    let text = '';
    try {
      text = tiptapDocToText(JSON.parse(item.body));
    } catch {
      text = '';
    }
    setForm({ name: item.name, body: text });
    setSaveError(null);
    setRolloutResult(null);
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
      const data = { name: form.name.trim(), body: JSON.stringify(textToTiptapDoc(form.body)) };
      if (editingId) {
        await system.updateDefaultLetter(token, editingId, data);
      } else {
        await system.createDefaultLetter(token, data);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete default standard letter "${name}"?`)) return;
    try {
      await system.deleteDefaultLetter(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRollout(id) {
    setRolloutId(id);
    setRolloutResult(null);
    setError(null);
    try {
      const result = await system.rolloutDefaultLetter(token, id);
      setRolloutResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setRolloutId(null);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">Default Standard Letters</h3>
      <p className="text-sm text-slate-500 mb-3">
        Seeded into every newly-created tenant. Use "Roll out" to push a template into every
        existing tenant that doesn't already have one of that name. Editing here is plain text only
        (one paragraph per line) — bold/heading formatting from an existing letter is preserved on
        load but not editable here.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-400 text-sm mb-3">No default standard letters yet.</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 align-top">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRollout(item.id)}
                      disabled={rolloutId === item.id}
                      className="text-xs text-emerald-600 hover:text-emerald-800 underline disabled:text-slate-400"
                    >
                      {rolloutId === item.id ? 'Rolling out…' : 'Roll out'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                      Delete
                    </button>
                    {rolloutResult && rolloutResult.template === item.name && (
                      <RolloutResult result={rolloutResult} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleSave} className="border-t border-slate-200 pt-4 max-w-xl">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          {editingId ? 'Edit default standard letter' : 'Add default standard letter'}
        </h4>
        {saveError && <p className="text-red-600 text-sm mb-2">{saveError}</p>}
        <div className="mb-3">
          <label htmlFor="def-letter-name" className={labelCls}>
            Name
          </label>
          <input
            id="def-letter-name"
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            disabled={!!editingId}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="def-letter-body" className={labelCls}>
            Letter body (one paragraph per line)
          </label>
          <textarea
            id="def-letter-body"
            rows={10}
            className={`${inputCls} font-mono text-xs`}
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function DefaultTemplatesSection() {
  return (
    <section className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-700 mb-1">
        Default Standard Emails &amp; Letters
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Manage the templates every new u3a tenant is seeded with, and roll updates out to existing
        tenants.
      </p>
      <MessagesSubsection />
      <LettersSubsection />
    </section>
  );
}
