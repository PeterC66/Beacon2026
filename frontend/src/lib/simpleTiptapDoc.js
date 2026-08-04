// beacon2026/frontend/src/lib/simpleTiptapDoc.js
// Std Letters store their body as a Tiptap document (see backend
// routes/letters.js tiptapToPdfContent()), but the group/team Std Letters
// tab offers a plain textarea rather than the full rich-text editor used on
// the Letter Compose page (frontend/src/pages/letters/LetterCompose.jsx).
// These helpers convert between "one paragraph per line" plain text and the
// minimal Tiptap doc shape — no bold/italic/underline/alignment support.
// Editing a richly-formatted letter here will flatten its formatting.

/** Plain text (one line = one paragraph) → a minimal Tiptap doc. */
export function textToTiptapDoc(text) {
  const lines = String(text ?? '').split('\n');
  return {
    type: 'doc',
    content: lines.map((line) =>
      line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
    ),
  };
}

/** Tiptap doc → plain text (one paragraph per line). Non-text marks/nodes are dropped. */
export function tiptapDocToText(doc) {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content
    .map((node) => (node.content || []).map((child) => child.text ?? '').join(''))
    .join('\n');
}
