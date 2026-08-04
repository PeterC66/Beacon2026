// beacon2026/frontend/src/components/StdLettersTab.jsx
// "Std Letters" tab on a Group or Team record — Standard Letters owned by
// this specific group/team. Shared between GroupRecord and TeamRecord.
// Props:
//   entityId — the group or team ID
//   api      — the API module (groups or teams), must have
//              listStdLetters/saveStdLetter/deleteStdLetter
//
// Letter bodies are stored as a Tiptap document (see backend routes/letters.js
// tiptapToPdfContent()). This tab uses the same shared rich-text editor as
// the Letter Compose page, so bold/italic/underline/alignment formatting
// round-trips correctly.

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useAuth } from '../context/AuthContext.jsx';
import { RICH_TEXT_EXTENSIONS, EditorToolbar } from './RichTextEditor.jsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js';

const EMPTY = { name: '' };

export default function StdLettersTab({ entityId, api }) {
  const { can } = useAuth();
  const { markDirty, markClean } = useUnsavedChanges();
  const [letters, setLetters] = useState([]);
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
    can('letters_standard_messages_all', 'create') ||
    can('letters_standard_messages_as_leader', 'create');
  const canDelete =
    can('letters_standard_messages_all', 'delete') ||
    can('letters_standard_messages_as_leader', 'delete');

  useEffect(() => {
    load();
  }, [entityId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLetters(await api.listStdLetters(entityId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(letter) {
    setEditingId(letter.id);
    setForm({ name: letter.name });
    if (editor) {
      try {
        editor.commands.setContent(JSON.parse(letter.body));
      } catch {
        editor.commands.setContent('<p></p>');
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
      await api.saveStdLetter(entityId, {
        name: form.name.trim(),
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
    if (!window.confirm(`Delete standard letter "${name}"?`)) return;
    try {
      await api.deleteStdLetter(entityId, id);
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
      <h2 className="text-lg font-semibold mb-1">Std Letters</h2>
      <p className="text-xs text-slate-600 mb-3">
        Standard letters owned by this group/team. Anyone composing a letter can load and use these
        — only this group/team's leaders (and Administration) can add, edit or delete them here.
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : letters.length === 0 ? (
        <p className="text-slate-500 text-sm mb-4">No standard letters yet.</p>
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
              {letters.map((l, i) => (
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
              onChange={(e) => set('name', e.target.value)}
              disabled={!!editingId}
            />
          </div>
          <div className="mb-3">
            <label className={labelCls}>Letter body</label>
            <EditorToolbar editor={editor} />
            <div className="border border-slate-300 rounded min-h-[250px] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 prose prose-sm max-w-none">
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
