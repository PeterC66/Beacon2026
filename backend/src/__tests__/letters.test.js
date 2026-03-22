// beacon2/backend/src/__tests__/letters.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { makeAuthHeader, TEST_TENANT } from './helpers.js';

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

beforeEach(() => { vi.clearAllMocks(); });

// ─── Standard Letters CRUD ───────────────────────────────────────────────

describe('GET /letters/standard-letters', () => {
  it('returns list of standard letters', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'sl-1', name: 'Welcome', body: '{"type":"doc","content":[]}' },
    ]);
    const res = await request.get('/letters/standard-letters').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Welcome');
  });

  it('returns 401 without auth', async () => {
    const res = await request.get('/letters/standard-letters');
    expect(res.status).toBe(401);
  });
});

describe('POST /letters/standard-letters', () => {
  it('creates a standard letter', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'sl-new', name: 'Renewal', body: '{}' },
    ]);
    const res = await request
      .post('/letters/standard-letters')
      .set('Authorization', auth)
      .send({ name: 'Renewal', body: '{}' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Renewal');
  });

  it('rejects empty name', async () => {
    const res = await request
      .post('/letters/standard-letters')
      .set('Authorization', auth)
      .send({ name: '', body: '{}' });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /letters/standard-letters/:id', () => {
  it('deletes a standard letter', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request
      .delete('/letters/standard-letters/sl-1')
      .set('Authorization', auth);
    expect(res.status).toBe(204);
  });
});

// ─── PDF Download ────────────────────────────────────────────────────────

describe('POST /letters/download', () => {
  const letterBody = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Dear #FORENAME,' }],
      },
    ],
  };

  it('returns a PDF for valid members', async () => {
    // fetchMembersForLetters query
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1', membership_number: 1, title: 'Mr', forenames: 'John', surname: 'Smith',
        known_as: null, email: 'john@test.com', mobile: '07700', next_renewal: null,
        home_u3a: null, class_name: 'Individual',
        house_no: '1', street: 'High St', add_line1: null, add_line2: null,
        town: 'Oxford', county: 'Oxon', postcode: 'OX1 1AA', telephone: '01234',
        p_id: null, p_title: null, p_forenames: null, p_surname: null,
        p_known_as: null, p_email: null, p_mobile: null, p_telephone: null,
      },
    ]);
    // getTenantDisplayName query
    tenantQuery.mockResolvedValueOnce([{ display_name: 'Test u3a' }]);

    const res = await request
      .post('/letters/download')
      .set('Authorization', auth)
      .send({ memberIds: ['m1'], body: letterBody });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/Letters\.pdf/);
    // Verify it's a valid PDF (starts with %PDF)
    expect(res.body.toString('ascii', 0, 5)).toBe('%PDF-');
  });

  it('returns 404 when no members found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // no members
    tenantQuery.mockResolvedValueOnce([{ display_name: 'Test u3a' }]);

    const res = await request
      .post('/letters/download')
      .set('Authorization', auth)
      .send({ memberIds: ['nonexistent'], body: letterBody });

    expect(res.status).toBe(404);
  });

  it('rejects missing memberIds', async () => {
    const res = await request
      .post('/letters/download')
      .set('Authorization', auth)
      .send({ body: letterBody });
    expect(res.status).toBe(422);
  });

  it('rejects invalid body structure', async () => {
    const res = await request
      .post('/letters/download')
      .set('Authorization', auth)
      .send({ memberIds: ['m1'], body: { type: 'invalid' } });
    expect(res.status).toBe(422);
  });
});
