// beacon2026/backend/src/__tests__/richEmailBody.test.js
// Unit coverage for resolveRichBody() — the TipTap-doc-to-HTML/text resolver
// backing the rich-formatted Email Compose screen (UX-Improvements-Plan item 4).

import { describe, it, expect } from 'vitest';
import { resolveRichBody } from '../utils/richEmailBody.js';

const MEMBER = {
  forenames: 'Jo',
  surname: 'Bloggs',
  known_as: null,
  address: { house_no: '1', street: 'High St', town: 'St Ives', postcode: 'PE27 1AA' },
};

function doc(...content) {
  return { type: 'doc', content };
}

function para(children, attrs) {
  return { type: 'paragraph', content: children, ...(attrs ? { attrs } : {}) };
}

function text(t, marks) {
  return { type: 'text', text: t, ...(marks ? { marks } : {}) };
}

describe('resolveRichBody', () => {
  it('renders plain paragraphs to matching HTML and text', () => {
    const body = doc(para([text('Hello there.')]));
    const { html, text: plain } = resolveRichBody('Subject', body, MEMBER, 'St Ives u3a');
    expect(html).toBe('<p>Hello there.</p>');
    expect(plain).toBe('Hello there.');
  });

  it('wraps marks (bold/italic/underline/fontSize) in the HTML output only', () => {
    const body = doc(
      para([
        text('bold', [{ type: 'bold' }]),
        text(' plain '),
        text('big', [{ type: 'textStyle', attrs: { fontSize: '18' } }]),
      ]),
    );
    const { html, text: plain } = resolveRichBody('S', body, MEMBER, 'u3a');
    expect(html).toBe('<p><strong>bold</strong> plain <span style="font-size:18pt">big</span></p>');
    expect(plain).toBe('bold plain big');
  });

  it('applies paragraph text-align as inline style, omitting it for left (default)', () => {
    const centred = doc(para([text('mid')], { textAlign: 'center' }));
    const left = doc(para([text('mid')], { textAlign: 'left' }));
    expect(resolveRichBody('S', centred, MEMBER, 'u3a').html).toBe(
      '<p style="text-align:center">mid</p>',
    );
    expect(resolveRichBody('S', left, MEMBER, 'u3a').html).toBe('<p>mid</p>');
  });

  it('converts hardBreak nodes to <br> in HTML and \\n in text', () => {
    const body = doc(para([text('line1'), { type: 'hardBreak' }, text('line2')]));
    const { html, text: plain } = resolveRichBody('S', body, MEMBER, 'u3a');
    expect(html).toBe('<p>line1<br>line2</p>');
    expect(plain).toBe('line1\nline2');
  });

  it('substitutes #TOKENs in subject, html and text for a given member', () => {
    const body = doc(para([text('Hi #FORENAME, welcome to #U3ANAME.')]));
    const {
      subject,
      html,
      text: plain,
    } = resolveRichBody('Renewal for #FORENAME', body, MEMBER, 'St Ives u3a');
    expect(subject).toBe('Renewal for Jo');
    expect(html).toBe('<p>Hi Jo, welcome to St Ives u3a.</p>');
    expect(plain).toBe('Hi Jo, welcome to St Ives u3a.');
  });

  it('HTML-escapes both admin-authored text and substituted token values', () => {
    const evilMember = { ...MEMBER, forenames: '<script>alert(1)</script>' };
    const body = doc(para([text('Tom & Jerry say hi to #FORENAME')]));
    const { html } = resolveRichBody('S', body, evilMember, 'u3a');
    expect(html).toBe('<p>Tom &amp; Jerry say hi to &lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html).not.toContain('<script>');
  });

  it('turns embedded newlines from multi-line token values (e.g. #ADDRESSV) into <br>', () => {
    const body = doc(para([text('#ADDRESSV')]));
    const { html, text: plain } = resolveRichBody('S', body, MEMBER, 'u3a');
    expect(html).toBe('<p>1<br>High St<br>St Ives<br>PE27 1AA</p>');
    expect(plain).toBe('1\nHigh St\nSt Ives\nPE27 1AA');
  });

  it('leaves #TOKENs unresolved verbatim when member is null (copy-to-self)', () => {
    const body = doc(para([text('Hi #FORENAME')]));
    const { subject, html, text: plain } = resolveRichBody('Subj #FORENAME', body, null);
    expect(subject).toBe('Subj #FORENAME');
    expect(html).toBe('<p>Hi #FORENAME</p>');
    expect(plain).toBe('Hi #FORENAME');
  });

  it('joins multiple paragraphs with a newline in the text fallback', () => {
    const body = doc(para([text('First.')]), para([text('Second.')]));
    const { text: plain, html } = resolveRichBody('S', body, MEMBER, 'u3a');
    expect(plain).toBe('First.\nSecond.');
    expect(html).toBe('<p>First.</p><p>Second.</p>');
  });

  it('renders an empty paragraph as a non-collapsing &nbsp;', () => {
    const body = doc(para([]));
    const { html } = resolveRichBody('S', body, MEMBER, 'u3a');
    expect(html).toBe('<p>&nbsp;</p>');
  });
});
