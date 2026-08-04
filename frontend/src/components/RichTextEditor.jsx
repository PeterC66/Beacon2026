// beacon2026/frontend/src/components/RichTextEditor.jsx
// Shared TipTap rich-text editor setup used by both LetterCompose.jsx and
// EmailCompose.jsx (UX-Improvements-Plan item 4 — bring email formatting to
// parity with letters). Exports the extension list + a font-size toolbar
// control so both compose screens use exactly one rich-text editor
// implementation.

import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';

// ── Font size extension ──────────────────────────────────────────────────

export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
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
      },
    ];
  },
});

export const FONT_SIZES = [
  { label: 'Small (10pt)', value: '10' },
  { label: 'Normal (12pt)', value: '12' },
  { label: 'Large (14pt)', value: '14' },
  { label: 'Huge (18pt)', value: '18' },
];

/** Editor extension list shared by every rich-text compose screen. */
export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({ heading: false }),
  Underline,
  TextAlign.configure({ types: ['paragraph'] }),
  TextStyle,
  FontSize,
];

// ── Toolbar ───────────────────────────────────────────────────────────────

export function ToolbarButton({ onClick, active, title, children }) {
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

export function EditorToolbar({ editor }) {
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
        name="fontSize"
        value={currentSize}
        onChange={(e) => {
          const size = e.target.value;
          editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
        }}
        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Font size"
      >
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
