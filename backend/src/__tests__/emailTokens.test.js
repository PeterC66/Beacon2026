// beacon2/backend/src/__tests__/emailTokens.test.js
// Regression tests for the email token resolver — in particular the
// HTML escaping of substituted values on the html/ field path.

import { describe, it, expect } from 'vitest';
import { resolveTokens } from '../utils/emailTokens.js';

const member = {
  forenames: '<script>alert(1)</script>',
  surname: "O'Brien",
  email: 'a@example.com',
  partner: {
    forenames: '<img src=x onerror=evil()>',
    surname: 'Partner',
  },
};

describe('resolveTokens', () => {
  it('returns the plain body with raw token values', () => {
    const { body } = resolveTokens('Hi', 'Hello #FORENAME', member, 'u3a');
    expect(body).toBe('Hello <script>alert(1)</script>');
  });

  it('returns the html body with token values HTML-escaped', () => {
    const { bodyHtml } = resolveTokens('Hi', 'Hello #FORENAME', member, 'u3a');
    expect(bodyHtml).toBe('Hello &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes partner-token values too', () => {
    const { bodyHtml } = resolveTokens('Hi', 'and #PFORENAME', member, 'u3a');
    expect(bodyHtml).toBe('and &lt;img src=x onerror=evil()&gt;');
  });

  it("doesn't escape the surrounding admin-authored markup", () => {
    const { bodyHtml } = resolveTokens(
      'Hi',
      '<a href="https://example.com">click</a> #FORENAME',
      member,
      'u3a',
    );
    expect(bodyHtml).toBe(
      '<a href="https://example.com">click</a> &lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes ampersand and quote characters', () => {
    const { bodyHtml } = resolveTokens('Hi', 'Hello #SURNAME', member, 'u3a');
    expect(bodyHtml).toBe('Hello O&#39;Brien');
  });
});
