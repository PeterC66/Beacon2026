// beacon2026/backend/src/__tests__/apiV1.test.js
// Coverage for the public read API (routes/api/*) — see docs/API-design.md.
//
// The most important tests here are the exact-key-set assertions. This is a
// published, anonymous, national interface, so the failure that matters is a
// field appearing in a response that the u3a never chose to publish. Asserting
// the whole key set (rather than the presence of individual fields) makes a
// carelessly added column fail the build instead of shipping quietly.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { dbMock, redisMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () => dbMock({ prisma: { sysTenant: { findUnique: vi.fn() } } }));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');

const SLUG = 'demo';
const BASE = `/api/v1/${SLUG}`;

/** feature_config with publicApi on and everything else defaulting on. */
const FEATURES_ON = [{ feature_config: { publicApi: true } }];

/** Nothing ticked public — the default for a u3a that never opened Public Links. */
const NOTHING_PUBLIC = [{ group_info_config: {}, calendar_config: {} }];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.sysTenant.findUnique.mockResolvedValue({ slug: SLUG, active: true, name: 'Demo u3a' });
});

// ── Tenant resolution and opt-in ────────────────────────────────────────────

describe('access control', () => {
  it('rejects a slug with a hyphen, matching the db.js guard', async () => {
    const res = await request(app).get('/api/v1/bad-slug/groups');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_slug');
  });

  it('404s an unknown u3a', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/v1/missing/groups');
    expect(res.status).toBe(404);
  });

  it('404s an inactive u3a', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ slug: SLUG, active: false, name: 'X' });
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.status).toBe(404);
  });

  it('404s — not 403 — when the u3a has not enabled the API', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: {} }]);
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('defaults publicApi to off when feature_config is empty', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: {} }]);
    const res = await request(app).get(`${BASE}/org`);
    expect(res.status).toBe(404);
  });

  it('404s an unknown path under a valid u3a', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON);
    const res = await request(app).get(`${BASE}/nonsense`);
    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('code');
  });
});

// ── Envelope, caching and headers ───────────────────────────────────────────

describe('envelope and caching', () => {
  it('wraps collections in data + meta and sets a public cache policy', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 7 }])
      .mockResolvedValueOnce([]);
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: { total: 7, limit: 50, offset: 0 } });
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers.etag).toBeDefined();
  });

  it('allows any origin, and permits cross-origin reads', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON).mockResolvedValueOnce([{}]);
    const res = await request(app).get(`${BASE}/org`).set('Origin', 'https://a-u3a.example');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('sends no deprecation headers while v1 is current', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON).mockResolvedValueOnce([{}]);
    const res = await request(app).get(`${BASE}/org`);
    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
  });

  it('signals deprecation in-band once a sunset date is set', async () => {
    process.env.API_V1_SUNSET = '2027-06-30';
    try {
      tenantQuery.mockResolvedValueOnce(FEATURES_ON).mockResolvedValueOnce([{}]);
      const res = await request(app).get(`${BASE}/org`);
      expect(res.headers.deprecation).toBe('true');
      expect(res.headers.sunset).toContain('2027');
    } finally {
      delete process.env.API_V1_SUNSET;
    }
  });

  it('serves the specification without needing a u3a', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/{slug}/groups']).toBeDefined();
  });
});

// ── Pagination ──────────────────────────────────────────────────────────────

describe('pagination', () => {
  it('rejects a limit above the maximum', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON);
    const res = await request(app).get(`${BASE}/groups?limit=500`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_query');
  });

  it('rejects a negative offset', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON);
    const res = await request(app).get(`${BASE}/groups?offset=-1`);
    expect(res.status).toBe(400);
  });

  it('passes limit and offset through to the query', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const res = await request(app).get(`${BASE}/groups?limit=10&offset=20`);
    expect(res.body.meta).toEqual({ total: 0, limit: 10, offset: 20 });
    const params = tenantQuery.mock.calls.at(-1)[2];
    expect(params).toEqual([10, 20]);
  });
});

// ── Groups: the visibility invariant ────────────────────────────────────────

const GROUP_ROW = {
  id: 'g1',
  name: 'Walking',
  status: 'active',
  when_text: '2nd Thursday',
  start_time: '14:00',
  end_time: '16:00',
  enquiries: 'walk@demo.example',
  information: 'Bring boots',
  faculty_id: 'f1',
  faculty_name: 'Outdoors',
  venue_name: 'Village Hall',
  venue_postcode: 'PE27 1AA',
};

describe('GET /groups', () => {
  it('exposes only identity and timing fields when nothing is ticked public', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([GROUP_ROW]);
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.status).toBe(200);
    // Exact key set: a new field cannot appear without updating this test.
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      'endTime',
      'faculty',
      'facultyId',
      'id',
      'name',
      'startTime',
      'when',
    ]);
  });

  it('never leaks enquiries, venue, information or status unless ticked', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([GROUP_ROW]);
    const res = await request(app).get(`${BASE}/groups`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('walk@demo.example');
    expect(body).not.toContain('Village Hall');
    expect(body).not.toContain('Bring boots');
    expect(res.body.data[0].status).toBeUndefined();
  });

  it('includes the fields the u3a has ticked public', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce([
        {
          group_info_config: {
            venue: { public: true },
            detail: { public: true },
            status: { public: true },
          },
          calendar_config: {},
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([GROUP_ROW]);
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.body.data[0].venue).toBe('Village Hall');
    expect(res.body.data[0].venuePostcode).toBe('PE27 1AA');
    expect(res.body.data[0].information).toBe('Bring boots');
    expect(res.body.data[0].status).toBe('active');
  });

  it('uses leader names for contact only when contacts are public', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce([
        { group_info_config: { contact: { public: true } }, calendar_config: {} },
      ])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([GROUP_ROW])
      .mockResolvedValueOnce([
        { group_id: 'g1', forenames: 'Ann Marie', surname: 'Blake', known_as: null },
      ]);
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.body.data[0].contact).toBe('Ann Blake');
  });

  it('does not query members at all when contacts are not public', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([GROUP_ROW]);
    await request(app).get(`${BASE}/groups`);
    const sql = tenantQuery.mock.calls.map((c) => c[1]).join(' ');
    expect(sql).not.toContain('group_members');
  });

  it('restricts to active interest groups, never teams', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    await request(app).get(`${BASE}/groups`);
    const sql = tenantQuery.mock.calls.at(-1)[1];
    expect(sql).toContain("g.status = 'active'");
    expect(sql).toContain("g.type = 'group'");
  });

  it('filters by faculty', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    await request(app).get(`${BASE}/groups?faculty=f1`);
    expect(tenantQuery.mock.calls.at(-1)[2]).toEqual(['f1', 50, 0]);
  });

  it('404s a group that is inactive or absent', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([]);
    const res = await request(app).get(`${BASE}/groups/nope`);
    expect(res.status).toBe(404);
  });

  it('404s the whole collection when the groups module is off', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { publicApi: true, groups: false } }]);
    const res = await request(app).get(`${BASE}/groups`);
    expect(res.status).toBe(404);
  });
});

// ── Events ──────────────────────────────────────────────────────────────────

const EVENT_ROW = {
  id: 'e1',
  event_date: '2026-09-10',
  start_time: '10:00',
  end_time: '12:00',
  group_id: 'g1',
  group_name: 'Walking',
  event_type_name: null,
  venue_name: 'Village Hall',
  venue_postcode: 'PE27 1AA',
  topic: 'Autumn walk',
  contact: 'walk@demo.example',
  details: 'Meet at the bridge',
};

describe('GET /events', () => {
  it('exposes only identity and timing fields by default', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([EVENT_ROW]);
    const res = await request(app).get(`${BASE}/events`);
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      'date',
      'endTime',
      'groupId',
      'groupName',
      'id',
      'startTime',
    ]);
  });

  it('never returns private events', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    await request(app).get(`${BASE}/events`);
    const sql = tenantQuery.mock.calls.at(-1)[1];
    expect(sql).toContain('ge.is_private IS NOT TRUE');
  });

  it('applies from, to and group filters', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    await request(app).get(`${BASE}/events?from=2026-09-01&to=2026-09-30&group=g1`);
    expect(tenantQuery.mock.calls.at(-1)[2]).toEqual(['2026-09-01', '2026-09-30', 'g1', 50, 0]);
  });

  it('rejects a malformed date', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON);
    const res = await request(app).get(`${BASE}/events?from=last-tuesday`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/YYYY-MM-DD/);
  });

  it('falls back to the event type name for open meetings', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce(NOTHING_PUBLIC)
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { ...EVENT_ROW, group_id: null, group_name: null, event_type_name: 'Open Meeting' },
      ]);
    const res = await request(app).get(`${BASE}/events`);
    expect(res.body.data[0].groupName).toBe('Open Meeting');
  });
});

// ── The iCalendar feed ──────────────────────────────────────────────────────
// Same data and the same visibility rules as GET /events, in a second
// serialisation. The leak guard is the same idea as the key-set assertions
// above, applied to VEVENT property names.

const ICS_ROW = {
  id: 'e1',
  event_date: '2026-09-01',
  start_time: '14:30:00',
  end_time: '16:00:00',
  group_name: 'Walking',
  event_type_name: null,
  venue_name: 'Village Hall',
  venue_postcode: 'PE27 1AA',
  topic: 'Autumn walk',
  contact: 'walk@demo.example',
  details: 'Meet at the bridge',
  stamp: '20260801T090000Z',
};

const ALL_CALENDAR_PUBLIC = [
  {
    group_info_config: {},
    calendar_config: {
      venue: { public: true },
      topic: { public: true },
      enquiries: { public: true },
      detail: { public: true },
    },
  },
];

/** Fetch the feed with a given visibility config and event rows. */
async function getIcs({ visibility = NOTHING_PUBLIC, rows = [ICS_ROW], query = '' } = {}) {
  tenantQuery
    .mockResolvedValueOnce(FEATURES_ON)
    .mockResolvedValueOnce(visibility)
    .mockResolvedValueOnce(rows);
  return request(app).get(`${BASE}/events.ics${query}`);
}

/** The property names used inside the first VEVENT, e.g. 'DTSTART;TZID=…' → 'DTSTART'. */
function veventProps(body) {
  const lines = body.split('\r\n');
  const start = lines.indexOf('BEGIN:VEVENT');
  const end = lines.indexOf('END:VEVENT');
  return lines
    .slice(start + 1, end)
    .filter((l) => !l.startsWith(' '))
    .map((l) => l.split(/[;:]/)[0])
    .sort();
}

describe('GET /events.ics', () => {
  it('serves a cacheable calendar that defines its own timezone', async () => {
    const res = await getIcs();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/calendar; charset=utf-8/);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers['content-disposition']).toBe('inline; filename="demo-events.ics"');
    expect(res.headers.etag).toBeDefined();
    expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(res.text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(res.text).toContain('TZID:Europe/London');
    expect(res.text).toContain('X-WR-CALNAME:Demo u3a');
  });

  it('publishes a timed event in local time with a stable uid', async () => {
    const res = await getIcs();
    expect(res.text).toContain('UID:e1@demo.beacon2026');
    expect(res.text).toContain('DTSTART;TZID=Europe/London:20260901T143000');
    expect(res.text).toContain('DTEND;TZID=Europe/London:20260901T160000');
    // From the row's updated_at, not the clock, so the feed is byte-stable.
    expect(res.text).toContain('DTSTAMP:20260801T090000Z');
  });

  it('publishes an event with no start time as an all-day event', async () => {
    const res = await getIcs({ rows: [{ ...ICS_ROW, start_time: null, end_time: null }] });
    expect(res.text).toContain('DTSTART;VALUE=DATE:20260901');
    expect(res.text).toContain('DTEND;VALUE=DATE:20260902');
  });

  it('omits an end time that is not after the start, rather than emitting invalid ics', async () => {
    const res = await getIcs({ rows: [{ ...ICS_ROW, end_time: '14:30:00' }] });
    expect(res.text).toContain('DTSTART;TZID=Europe/London:20260901T143000');
    expect(res.text).not.toContain('DTEND');
  });

  it('exposes only identity and timing properties when nothing is ticked public', async () => {
    const res = await getIcs();
    expect(veventProps(res.text)).toEqual([
      'DTEND',
      'DTSTAMP',
      'DTSTART',
      'LAST-MODIFIED',
      'SUMMARY',
      'UID',
    ]);
    for (const secret of ['Village Hall', 'PE27', 'Autumn walk', 'walk@demo.example', 'bridge']) {
      expect(res.text).not.toContain(secret);
    }
    expect(res.text).toContain('SUMMARY:Walking');
  });

  it('includes venue, topic, details and enquiries once they are ticked public', async () => {
    const res = await getIcs({ visibility: ALL_CALENDAR_PUBLIC });
    expect(veventProps(res.text)).toContain('LOCATION');
    expect(veventProps(res.text)).toContain('DESCRIPTION');
    expect(res.text).toContain('SUMMARY:Walking: Autumn walk');
    expect(res.text).toContain('LOCATION:Village Hall');
    expect(res.text).toContain('Meet at the bridge');
    expect(res.text).toContain('Enquiries: walk@demo.example');
  });

  it('falls back to the event type name for open meetings', async () => {
    const res = await getIcs({
      rows: [{ ...ICS_ROW, group_name: null, event_type_name: 'Open Meeting' }],
    });
    expect(res.text).toContain('SUMMARY:Open Meeting');
  });

  it('escapes separators and folds long lines to 75 octets', async () => {
    // The dash is 3 bytes and the run of them is long enough that a naive
    // 75-character fold is guaranteed to cut one in half.
    const dashes = '—'.repeat(40);
    const res = await getIcs({
      visibility: ALL_CALENDAR_PUBLIC,
      rows: [
        {
          ...ICS_ROW,
          group_name: `Walking, Rambling; and Strolling ${dashes} the long way round`,
          topic: 'Bring a coat\nand boots',
        },
      ],
    });
    expect(res.text).toContain('Walking\\, Rambling\\; and Strolling');
    expect(res.text).toContain('Bring a coat\\nand boots');
    for (const line of res.text.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    // Unfolding must give back exactly what went in — a split that landed
    // inside a dash would surface as U+FFFD here.
    const unfolded = res.text.replace(/\r\n /g, '');
    expect(unfolded).not.toContain('�');
    expect(unfolded).toContain(`Strolling ${dashes} the long way round`);
  });

  it('never includes private events, and reaches a bounded way back', async () => {
    await getIcs();
    const [, sql, params] = tenantQuery.mock.calls.at(-1);
    expect(sql).toContain('ge.is_private IS NOT TRUE');
    expect(sql).toContain('ge.event_date >= $1::date');
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.at(-1)).toBe(5000); // the VEVENT ceiling, not a page size
  });

  it('filters to one group and names the calendar after it', async () => {
    const res = await getIcs({ query: '?group=g1' });
    expect(tenantQuery.mock.calls.at(-1)[2]).toContain('g1');
    expect(res.text).toContain('X-WR-CALNAME:Demo u3a — Walking');
  });

  it('404s when the u3a has not enabled the API', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: {} }]);
    const res = await request(app).get(`${BASE}/events.ics`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

// ── Venues, faculties and org ───────────────────────────────────────────────

describe('venues, faculties and org', () => {
  it('404s venues when the u3a does not publish venues', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON).mockResolvedValueOnce(NOTHING_PUBLIC);
    const res = await request(app).get(`${BASE}/venues`);
    expect(res.status).toBe(404);
  });

  it('returns name and postcode only when venues are public', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce([
        { group_info_config: { venue: { public: true } }, calendar_config: {} },
      ])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { id: 'v1', name: 'Village Hall', postcode: 'PE27 1AA', address1: '1 High St' },
      ]);
    const res = await request(app).get(`${BASE}/venues`);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'name', 'postcode']);
    expect(JSON.stringify(res.body)).not.toContain('High St');
  });

  it('returns faculties as id and name only', async () => {
    tenantQuery
      .mockResolvedValueOnce(FEATURES_ON)
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 'f1', name: 'Outdoors', created_at: 'x' }]);
    const res = await request(app).get(`${BASE}/faculties`);
    expect(res.body.data).toEqual([{ id: 'f1', name: 'Outdoors' }]);
  });

  it('returns the u3a public contact details', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON).mockResolvedValueOnce([
      {
        public_phone: '01480 000000',
        public_email: 'info@demo.example',
        home_page: 'https://demo.example',
      },
    ]);
    const res = await request(app).get(`${BASE}/org`);
    expect(res.body.data).toEqual({
      slug: SLUG,
      name: 'Demo u3a',
      phone: '01480 000000',
      email: 'info@demo.example',
      homePage: 'https://demo.example',
    });
  });
});

// ── The specification must describe what actually exists ────────────────────
// A hand-written spec is only worth having if it cannot drift from the code.
// This is the guard: every route must be documented and every documented path
// must exist, both ways round.

describe('specification matches the routes', () => {
  it('documents every route, and every documented path exists', async () => {
    const modules = await Promise.all([
      import('../routes/api/org.js'),
      import('../routes/api/faculties.js'),
      import('../routes/api/venues.js'),
      import('../routes/api/groups.js'),
      import('../routes/api/events.js'),
      import('../routes/api/ics.js'),
    ]);

    // '/:slug/groups/:id' (Express) → '/{slug}/groups/{id}' (OpenAPI)
    const actual = modules
      .flatMap((m) => m.default.stack.filter((l) => l.route).map((l) => l.route.path))
      .map((p) => p.replace(/:([A-Za-z]+)/g, '{$1}'))
      .sort();

    const res = await request(app).get('/api/v1/openapi.json');
    const documented = Object.keys(res.body.paths).sort();

    // Guard against a vacuous pass if router introspection ever returns nothing.
    expect(actual.length).toBeGreaterThanOrEqual(9);
    expect(documented).toEqual(actual);
  });
});

// ── No member data, ever ────────────────────────────────────────────────────

describe('member data is unreachable', () => {
  it('has no members endpoint in v1', async () => {
    tenantQuery.mockResolvedValueOnce(FEATURES_ON);
    const res = await request(app).get(`${BASE}/members`);
    expect(res.status).toBe(404);
  });

  it('does not describe a members path in the specification', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    const paths = Object.keys(res.body.paths).join(' ');
    expect(paths).not.toContain('member');
  });
});
