// beacon2/frontend/src/pages/letters/LetterCompose.jsx
// Compose and download letters for selected members.
// Member IDs are passed via sessionStorage key 'letterComposeMemberIds'.
// Docs 6.2, 6.2.1, 6.2.2

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import { letters as lettersApi, members as membersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

// ── Font size extension ──────────────────────────────────────────────────

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize?.replace(/[^0-9]/g, '') || null,
          renderHTML: (attrs) => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}pt` };
          },
        },
      },
    }];
  },
});

const FONT_SIZES = [
  { label: 'Small (10pt)',  value: '10' },
  { label: 'Normal (12pt)', value: '12' },
  { label: 'Large (14pt)',  value: '14' },
  { label: 'Huge (18pt)',   value: '18' },
];

// ── Token lists (same as email) ──────────────────────────────────────────

const TOKENS = [
  { token: '#FAM',         desc: 'Familiar name' },
  { token: '#FORENAME',    desc: 'Forename(s)' },
  { token: '#SURNAME',     desc: 'Surname' },
  { token: '#TITLE',       desc: 'Title' },
  { token: '#MEMNO',       desc: 'Membership number' },
  { token: '#U3ANAME',     desc: 'u3a name' },
  { token: '#EMAIL',       desc: 'Email address' },
  { token: '#TELEPHONE',   desc: 'Telephone' },
  { token: '#MOBILE',      desc: 'Mobile' },
  { token: '#ADDRESSV',    desc: 'Address (vertical)' },
  { token: '#RENEW',       desc: 'Renewal date' },
  { token: '#MEMCLASS',    desc: 'Membership class' },
  { token: '#AFFILIATION', desc: 'Affiliation' },
];

const PARTNER_TOKENS = [
  { token: '#PFAM',       desc: "Partner's familiar name" },
  { token: '#PFORENAME',  desc: "Partner's forename" },
  { token: '#PSURNAME',   desc: "Partner's surname" },
  { token: '#PTITLE',     desc: "Partner's title" },
  { token: '#PEMAIL',     desc: "Partner's email" },
  { token: '#PTELEPHONE', desc: "Partner's telephone" },
  { token: '#PMOBILE',    desc: "Partner's mobile" },
];

// ── Toolbar component ────────────────────────────────────────────────────

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium border transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 border-blue-300'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }) {
  if (!editor) return null;

  const currentSize = editor.getAttributes('textStyle').fontSize || '12';

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 mb-2">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <span className="border-l border-slate-300 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align left"
      >
        &#8676;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Align centre"
      >
        &#8596;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align right"
      >
        &#8677;
      </ToolbarButton>

      <span className="border-l border-slate-300 mx-1" />

      <select
        value={currentSize}
        onChange={(e) => {
          const size = e.target.value;
          editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
        }}
        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Font size"
      >
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function LetterCompose() {
  const { can, tenant } = useAuth();

  const [memberIds,     setMemberIds]     = useState([]);
  const [recipients,    setRecipients]    = useState([]);
  const [stdLetters,    setStdLetters]    = useState([]);
  const [loadLetterId,  setLoadLetterId]  = useState('');
  const [showSaveRow,   setShowSaveRow]   = useState(false);
  const [saveName,      setSaveName]      = useState('');
  const [downloading,   setDownloading]   = useState(false);
  const [error,         setError]         = useState(null);
  const [downloaded,    setDownloaded]    = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TextAlign.configure({ types: ['paragraph'] }),
      TextStyle,
      FontSize,
    ],
    content: '<p></p>',
  });

  // Read member IDs from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('letterComposeMemberIds');
      if (stored) {
        const ids = JSON.parse(stored);
        setMemberIds(ids);
        sessionStorage.removeItem('letterComposeMemberIds');
      }
    } catch { /* ignore */ }

    // Load standard letters
    if (can('letters_standard_messages', 'view')) {
      lettersApi.listStandardLetters().then(setStdLetters).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recipient display info
  useEffect(() => {
    if (memberIds.length === 0) return;
    membersApi.list({}).then((all) => {
      const idSet = new Set(memberIds);
      setRecipients(all.filter((m) => idSet.has(m.id)));
    }).catch(() => {});
  }, [memberIds]);

  const insertToken = useCallback((token) => {
    if (!editor) return;
    editor.chain().focus().insertContent(token).run();
  }, [editor]);

  function handleLoadLetter(id) {
    if (!id || !editor) return;
    const letter = stdLetters.find((l) => l.id === id);
    if (letter) {
      try {
        const bodyJson = JSON.parse(letter.body);
        editor.commands.setContent(bodyJson);
      } catch {
        // If body is not JSON (plain text), set as paragraph
        editor.commands.setContent(`<p>${letter.body}</p>`);
      }
    }
    setLoadLetterId('');
  }

  async function handleSaveLetter() {
    if (!saveName.trim() || !editor) return;
    try {
      const bodyJson = JSON.stringify(editor.getJSON());
      const saved = await lettersApi.saveStandardLetter({ name: saveName.trim(), body: bodyJson });
      setStdLetters((prev) => {
        const filtered = prev.filter((l) => l.name !== saved.name);
        return [...filtered, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSaveName('');
      setShowSaveRow(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteLetter() {
    if (!loadLetterId) return;
    const letter = stdLetters.find((l) => l.id === loadLetterId);
    if (!letter || !confirm(`Delete standard letter "${letter.name}"?`)) return;
    try {
      await lettersApi.deleteStandardLetter(loadLetterId);
      setStdLetters((prev) => prev.filter((l) => l.id !== loadLetterId));
      setLoadLetterId('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDownload() {
    if (!editor || memberIds.length === 0) return;
    const bodyJson = editor.getJSON();
    setDownloading(true);
    setError(null);
    try {
      await lettersApi.download({ memberIds, body: bodyJson });
      setDownloaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const navLinks = [{ label: 'Home', to: '/' }, { label: 'Members', to: '/members' }];

  if (downloaded) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={navLinks} />
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <p className="text-green-700 font-medium text-lg">Letters downloaded successfully</p>
            <p className="text-slate-600 mt-2">{recipients.length} letter{recipients.length !== 1 ? 's' : ''} generated.</p>
            <div className="mt-4 flex justify-center gap-4">
              <button onClick={() => setDownloaded(false)} className="text-blue-700 hover:underline text-sm">
                Compose another
              </button>
              <span className="text-slate-400">|</span>
              <Link to="/members" className="text-blue-700 hover:underline text-sm">Members</Link>
              <span className="text-slate-400">|</span>
              <Link to="/" className="text-blue-700 hover:underline text-sm">Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Compose Letter</h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Main compose area */}
          <div className="md:col-span-2 space-y-4">

            {/* Recipients */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Recipients ({recipients.length} member{recipients.length !== 1 ? 's' : ''})
              </label>
              <div className="border border-slate-200 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600 max-h-20 overflow-y-auto">
                {recipients.length === 0 ? (
                  <span className="text-slate-400 italic">No recipients selected</span>
                ) : (
                  recipients.slice(0, 5).map((r) => (
                    <div key={r.id}>{r.forenames} {r.surname}</div>
                  ))
                )}
                {recipients.length > 5 && <div className="text-slate-400">… and {recipients.length - 5} more</div>}
              </div>
            </div>

            {/* Standard letters bar */}
            {can('letters_standard_messages', 'view') && (
              <div className="bg-white/90 rounded-lg shadow-sm p-3 flex flex-wrap gap-2 items-center">
                <select
                  value={loadLetterId}
                  onChange={(e) => { setLoadLetterId(e.target.value); handleLoadLetter(e.target.value); }}
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Load standard letter…</option>
                  {stdLetters.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {can('letters_standard_messages', 'delete') && loadLetterId && (
                  <button
                    type="button"
                    onClick={handleDeleteLetter}
                    className="border border-red-300 text-red-700 hover:bg-red-50 rounded px-3 py-1.5 text-sm"
                  >
                    Delete standard letter
                  </button>
                )}
                {can('letters_standard_messages', 'create') && (
                  <button
                    type="button"
                    onClick={() => setShowSaveRow((v) => !v)}
                    className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-3 py-1.5 text-sm"
                  >
                    Save as standard letter
                  </button>
                )}
                {showSaveRow && (
                  <div className="flex gap-2 w-full mt-1">
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Letter name"
                      className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleSaveLetter} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm">Save</button>
                    <button onClick={() => { setShowSaveRow(false); setSaveName(''); }} className="border border-slate-300 text-slate-700 rounded px-3 py-1.5 text-sm">Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* Editor */}
            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Letter body</label>
              <EditorToolbar editor={editor} />
              <div className="border border-slate-300 rounded min-h-[400px] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 prose prose-sm max-w-none">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Download button */}
            <div className="flex gap-3 justify-end">
              <Link to="/members" className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded px-5 py-2 text-sm">
                Cancel
              </Link>
              <button
                onClick={handleDownload}
                disabled={downloading || memberIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors"
              >
                {downloading ? 'Generating…' : `Download (${recipients.length} letter${recipients.length !== 1 ? 's' : ''})`}
              </button>
            </div>

          </div>

          {/* Token panel */}
          <div className="space-y-3">
            <div className="bg-white/90 rounded-lg shadow-sm p-4">
              <h2 className="text-sm font-bold text-slate-700 mb-2">Tokens — click to insert</h2>
              <p className="text-xs text-slate-500 mb-3">Click a token to insert it at the cursor position. Tokens are replaced with each member's details when generating the PDF.</p>
              <div className="space-y-1">
                {TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 group"
                  >
                    <span className="text-blue-700 font-mono text-xs font-bold">{t.token}</span>
                    <span className="text-slate-500 text-xs ml-2">{t.desc}</span>
                  </button>
                ))}
              </div>
              <h3 className="text-sm font-bold text-slate-700 mt-4 mb-2">Partner Tokens</h3>
              <div className="space-y-1">
                {PARTNER_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50"
                  >
                    <span className="text-blue-700 font-mono text-xs font-bold">{t.token}</span>
                    <span className="text-slate-500 text-xs ml-2">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
