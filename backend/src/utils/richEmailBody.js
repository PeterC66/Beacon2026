// beacon2026/backend/src/utils/richEmailBody.js
// Resolves a TipTap rich-text JSON document (the shape produced by
// EmailCompose.jsx / LetterCompose.jsx's editor.getJSON()) into an HTML body
// and a plain-text fallback, with per-recipient #TOKEN substitution.
// Understands the same paragraph/heading/mark set as routes/letters.js's
// tiptapToPdfContent() (bold, italic, underline, textStyle fontSize,
// paragraph alignment, hardBreak) so an email composed with the same editor
// renders consistently with a downloaded letter.

import { applyTokens, buildTokenMap, escapeHtml } from './emailTokens.js';

/**
 * Render one paragraph/heading node's children to { html, text }.
 * Admin-authored text is HTML-escaped before token substitution (tokens
 * match fine post-escape, since `#FOO` contains no characters escapeHtml
 * touches); each substituted token *value* is escaped individually so
 * member-supplied data (partner name, etc.) can't inject markup into a
 * broadcast that resolves other recipients' tokens.
 */
function renderNode(child, tokenMap) {
  if (child.type === 'hardBreak') return { html: '<br>', text: '\n' };
  if (child.type !== 'text' || !child.text) return { html: '', text: '' };

  const html = tokenMap
    ? applyTokens(escapeHtml(child.text), tokenMap, { valueEscapeHtml: true })
    : escapeHtml(child.text);
  const text = tokenMap ? applyTokens(child.text, tokenMap) : child.text;

  const marks = child.marks || [];
  let wrapped = html;
  if (marks.some((m) => m.type === 'bold')) wrapped = `<strong>${wrapped}</strong>`;
  if (marks.some((m) => m.type === 'italic')) wrapped = `<em>${wrapped}</em>`;
  if (marks.some((m) => m.type === 'underline')) wrapped = `<u>${wrapped}</u>`;
  const styleMark = marks.find((m) => m.type === 'textStyle');
  if (styleMark?.attrs?.fontSize) {
    wrapped = `<span style="font-size:${parseInt(styleMark.attrs.fontSize, 10)}pt">${wrapped}</span>`;
  }

  return { html: wrapped, text };
}

/**
 * Resolve a TipTap doc + subject for one recipient.
 *
 * @param {string} subject - raw subject template (may contain #TOKENs)
 * @param {object} doc - TipTap JSON document ({ type: 'doc', content: [...] })
 * @param {object|null} member - member row for token resolution, or null to
 *   leave #TOKENs unresolved verbatim (used for the "copy to self" send,
 *   which intentionally skips personalisation)
 * @param {string} [u3aName] - tenant display name, ignored when member is null
 * @param {object} [extraTokens] - extra token map (e.g. Gift Aid tokens)
 * @returns {{ subject: string, html: string, text: string }}
 */
export function resolveRichBody(subject, doc, member, u3aName, extraTokens) {
  const tokenMap = member ? { ...buildTokenMap(member, u3aName), ...extraTokens } : null;
  const resolvedSubject = tokenMap ? applyTokens(subject, tokenMap) : subject;

  const htmlParts = [];
  const textParts = [];
  for (const node of doc?.content || []) {
    if (node.type !== 'paragraph' && node.type !== 'heading') continue;

    let html = '';
    let text = '';
    for (const child of node.content || []) {
      const r = renderNode(child, tokenMap);
      html += r.html;
      text += r.text;
    }

    const styleParts = [];
    if (node.attrs?.textAlign && node.attrs.textAlign !== 'left') {
      styleParts.push(`text-align:${node.attrs.textAlign}`);
    }
    const styleAttr = styleParts.length ? ` style="${styleParts.join(';')}"` : '';
    const tag = node.type === 'heading' ? `h${node.attrs?.level || 3}` : 'p';

    // Token values (e.g. #ADDRESSV) can carry embedded newlines — turn those
    // into <br> the same way an explicit hardBreak node already is.
    const htmlContent = (html || '&nbsp;').replace(/\n/g, '<br>');
    htmlParts.push(`<${tag}${styleAttr}>${htmlContent}</${tag}>`);
    textParts.push(text);
  }

  return {
    subject: resolvedSubject,
    html: htmlParts.join(''),
    text: textParts.join('\n'),
  };
}
