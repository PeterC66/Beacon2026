// Tests for membership cards routes (doc 4.7)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader, TEST_TENANT } from './helpers.js';

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/db.js', () => ({
  prisma: {
    $disconnect: vi.fn(),
    sysTenant: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Test U3A' }),
    },
  },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');
const { generateSingleCardPdf } = await import('../routes/membershipCards.js');

const AUTH = makeAuthHeader();

const SAMPLE_MEMBER = {
  id: 'm1',
  membership_number: 1001,
  title: 'Mr',
  forenames: 'John',
  known_as: null,
  surname: 'Smith',
  initials: 'J',
  suffix: null,
  email: 'john@example.com',
  mobile: '07700900000',
  status_id: 'st1',
  class_id: 'mc1',
  next_renewal: '2026-06-01',
  card_printed: false,
  joined_on: '2024-01-15',
  status_name: 'Current',
  class_name: 'Individual',
  house_no: '1',
  street: 'High St',
  add_line1: null,
  add_line2: null,
  town: 'Testville',
  county: 'Testshire',
  postcode: 'TE1 1ST',
  telephone: '01onal',
};

const SETTINGS_ROW = {
  card_colour: '#99FF99',
  year_start_month: 6,
  year_start_day: 1,
};

describe('GET /membership-cards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    const res = await request(app)
      .get('/membership-cards?show=outstanding')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].surname).toBe('Smith');
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app)
      .get('/membership-cards')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

describe('GET /membership-cards/download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 with no ids', async () => {
    const res = await request(app)
      .get('/membership-cards/download?ids=')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 200 with PDF content-type', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]); // fetchMembersById
    tenantQuery.mockResolvedValueOnce([SETTINGS_ROW]);   // getCardSettings
    const res = await request(app)
      .get('/membership-cards/download?ids=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('membership_cards');
  });
});

describe('GET /membership-cards/blank', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with PDF content-type', async () => {
    tenantQuery.mockResolvedValueOnce([SETTINGS_ROW]); // getCardSettings
    const res = await request(app)
      .get('/membership-cards/blank')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('blank_cards');
  });
});

describe('GET /membership-cards/excel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 with no ids', async () => {
    const res = await request(app)
      .get('/membership-cards/excel?ids=')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 200 with Excel content-type', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]); // fetchMembersById
    tenantQuery.mockResolvedValueOnce([SETTINGS_ROW]);   // getCardSettings
    const res = await request(app)
      .get('/membership-cards/excel?ids=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('card_data');
  });
});

describe('POST /membership-cards/mark-printed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 with no memberIds', async () => {
    const res = await request(app)
      .post('/membership-cards/mark-printed')
      .set('Authorization', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 and marks members as printed', async () => {
    tenantQuery.mockResolvedValueOnce([]); // UPDATE result
    const res = await request(app)
      .post('/membership-cards/mark-printed')
      .set('Authorization', AUTH)
      .send({ memberIds: ['m1', 'm2'] });
    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(2);
    // Verify the SQL includes card_printed = true
    const sql = tenantQuery.mock.calls[0][1];
    expect(sql).toContain('card_printed = true');
  });
});

describe('GET /membership-cards/single-pdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 without memberId', async () => {
    const res = await request(app)
      .get('/membership-cards/single-pdf')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 when member not found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // No member found
    const res = await request(app)
      .get('/membership-cards/single-pdf?memberId=m99')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });

  it('returns 200 with PDF for valid member', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]); // fetchMembersById
    tenantQuery.mockResolvedValueOnce([SETTINGS_ROW]);   // getCardSettings
    const res = await request(app)
      .get('/membership-cards/single-pdf?memberId=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

describe('generateSingleCardPdf (exported helper)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a PDF buffer and filename for a valid member', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]); // fetchMembersById
    tenantQuery.mockResolvedValueOnce([SETTINGS_ROW]);   // getCardSettings
    const { pdfBuffer, filename } = await generateSingleCardPdf('test-u3a', 'm1');
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    // PDF magic bytes
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    expect(filename).toContain('1001');
    expect(filename).toMatch(/\.pdf$/);
  });

  it('throws when member not found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // empty result
    await expect(generateSingleCardPdf('test-u3a', 'm99'))
      .rejects.toThrow('not found');
  });

  it('supports advanceYear parameter', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    tenantQuery.mockResolvedValueOnce([SETTINGS_ROW]);
    const { pdfBuffer } = await generateSingleCardPdf('test-u3a', 'm1', true);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
