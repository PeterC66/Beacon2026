// beacon2026/backend/src/__tests__/defaultTemplatesBootstrap.test.js
// Sanity checks for the Standard Email/Letter templates used to bootstrap
// the System Admin-maintained default_standard_messages/letters master
// tables (utils/migrate.js seedDefaultTemplates(), see item 11 of
// docs/UX-Improvements-Plan-2026-08-04.md) — every #TOKEN used must be one
// emailTokens.js actually resolves, and no tenant-specific detail (a real
// u3a's own address/phone/email) should have leaked into what's meant to be
// a generic default.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { makeAuthHeader } from './helpers.js';
import { buildTokenMap } from '../utils/emailTokens.js';
import {
  BOOTSTRAP_STANDARD_MESSAGES as DEFAULT_STANDARD_MESSAGES,
  BOOTSTRAP_STANDARD_LETTERS as DEFAULT_STANDARD_LETTERS,
} from '../utils/migrate.js';

vi.mock('../utils/db.js', () => ({
  prisma: { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant: vi.fn(),
}));
vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
}));

const { tenantQuery } = await import('../utils/db.js');
const { default: app } = await import('../app.js');
const request = supertest(app);
const auth = makeAuthHeader();

beforeEach(() => {
  vi.clearAllMocks();
});

const KNOWN_TOKENS = new Set(Object.keys(buildTokenMap({}, 'Test u3a')));

function tokensUsedIn(text) {
  return [...text.matchAll(/#[A-Z0-9]+/g)].map((m) => m[0]);
}

describe('default Standard Email Messages', () => {
  it.each(DEFAULT_STANDARD_MESSAGES)('$name only uses known tokens', ({ subject, body }) => {
    for (const token of tokensUsedIn(`${subject} ${body}`)) {
      expect(KNOWN_TOKENS.has(token)).toBe(true);
    }
  });

  it('has the two expected default messages', () => {
    const names = DEFAULT_STANDARD_MESSAGES.map((m) => m.name);
    expect(names).toEqual(['New Member Welcome', 'Renewal Confirmation']);
  });
});

function textOfTiptapDoc(doc) {
  const parts = [];
  for (const node of doc.content || []) {
    for (const child of node.content || []) {
      if (child.type === 'text') parts.push(child.text);
    }
  }
  return parts.join(' ');
}

describe('default Standard Letters', () => {
  it('body is a valid Tiptap doc (as required by tiptapToPdfContent)', () => {
    for (const letter of DEFAULT_STANDARD_LETTERS) {
      const doc = JSON.parse(letter.body);
      expect(doc.type).toBe('doc');
      expect(Array.isArray(doc.content)).toBe(true);
    }
  });

  it.each(DEFAULT_STANDARD_LETTERS)('$name only uses known tokens', ({ body }) => {
    const text = textOfTiptapDoc(JSON.parse(body));
    for (const token of tokensUsedIn(text)) {
      expect(KNOWN_TOKENS.has(token)).toBe(true);
    }
  });

  it('does not contain a real u3a’s own contact details', () => {
    const body = DEFAULT_STANDARD_LETTERS.find((l) => l.name === 'Annual Data Check Form').body;
    expect(body).not.toMatch(/u3aivo\.uk/);
    expect(body).not.toMatch(/07458 ?197372/);
    expect(body).not.toMatch(/Needingworth/i);
    expect(body).not.toMatch(/Spinney Way/i);
  });

  it('actually generates a PDF via /letters/download', async () => {
    const doc = JSON.parse(
      DEFAULT_STANDARD_LETTERS.find((l) => l.name === 'Annual Data Check Form').body,
    );
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1',
        membership_number: 1,
        title: 'Mr',
        forenames: 'John',
        surname: 'Smith',
        known_as: null,
        email: 'john@test.com',
        mobile: '07700',
        next_renewal: null,
        home_u3a: null,
        class_name: 'Individual',
        house_no: '1',
        street: 'High St',
        add_line1: null,
        add_line2: null,
        town: 'Oxford',
        county: 'Oxon',
        postcode: 'OX1 1AA',
        telephone: '01234',
        p_id: null,
        p_title: null,
        p_forenames: null,
        p_surname: null,
        p_known_as: null,
        p_email: null,
        p_mobile: null,
        p_telephone: null,
      },
    ]);
    tenantQuery.mockResolvedValueOnce([{ display_name: 'Test u3a' }]);

    const res = await request
      .post('/letters/download')
      .set('Authorization', auth)
      .send({ memberIds: ['m1'], body: doc });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.toString('ascii', 0, 5)).toBe('%PDF-');
  });
});
