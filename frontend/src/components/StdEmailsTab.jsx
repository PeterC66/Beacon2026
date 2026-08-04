// beacon2026/frontend/src/components/StdEmailsTab.jsx
// "Std Emails" tab on a Group or Team record — Standard Email Messages
// owned by this specific group/team. Shared between GroupRecord and
// TeamRecord (like EntityMembers.jsx).
// Props:
//   entityId — the group or team ID
//   api      — the API module (groups or teams), must have
//              listStdMessages/saveStdMessage/deleteStdMessage
//
// Message bodies are stored as a Tiptap document (see EmailCompose.jsx /
// backend/src/utils/richEmailBody.js), matching StdLettersTab.jsx. This tab
// uses the same shared rich-text editor as the Email Compose page, so
// bold/italic/underline/alignment formatting round-trips correctly.

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useAuth } from '../context/AuthContext.jsx';
import { RICH_TEXT_EXTENSIONS, EditorToolbar } from './RichTextEditor.jsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js';

const EMPTY = { name: '', subject: '' };

export default function StdEmailsTab({ entityId, api }) {
  const { can } = useAuth();
  const { markDirty, markClean } = useUnsavedChanges();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const editor = useEditor({
    extensions: RICH_TEXT_EXTENSIONS,
    content: '<p></p>',
    onUpdate: () => markDirty(),
  });

  const canManage =
    can('email_standard_messages_all', 'create') ||
    can('email_standard_messages_as_leader', 'create');
  const canDelete =
    can('email_standard_messages_all', 'delete') ||
    can('email_standard_messages_as_leader', 'delete');

  useEffect(() => {
    load();
  }, [entityId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMessages(await api.listStdMessages(entityId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(msg) {
    setEditingId(msg.id);
    setForm({ name: msg.name, subject: msg.subject ?? '' });
    if (editor) {
      try {
        editor.commands.setContent(JSON.parse(msg.body));
      } catch {
        // Legacy plain-text body (pre-dates rich-text storage) — wrap as-is.
        editor.commands.setContent(`<p>${msg.body}</p>`);
      }
    }
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    editor?.commands.setContent('<p></p>');
    setSaveError(null);
    markClean();
  }

  function set(field, value) {
    markDirty();
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !editor) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveStdMessage(entityId, {
        name: form.name.trim(),
        subject: form.subject,
        body: JSON.stringify(editor.getJSON()),
      });
      markClean();
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
      await api.deleteStdMessage(entityId, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls =
    'border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-0.5';

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Std Emails</h2>
      <p className="text-xs text-slate-600 mb-3">
        Standard email messages owned by this group/team. Anyone composing an email can load and use
        these — only this group/team's leaders (and Administration) can add, edit or delete them
        here.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-slate-500 text-sm mb-4">No standard emails yet.</p>
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
                onChange={(e) => set('name', e.target.value)}
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
                onChange={(e) => set('subject', e.target.value)}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Message body</label>
            <EditorToolbar editor={editor} />
            <div className="border border-slate-300 rounded min-h-[200px] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 prose prose-sm max-w-none">
              <EditorContent editor={editor} />
            </div>
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
