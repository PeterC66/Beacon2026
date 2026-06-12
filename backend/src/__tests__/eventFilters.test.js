// beacon2/backend/src/__tests__/eventFilters.test.js
// Unit tests for the shared calendar/event WHERE-clause builders
// (ImprovementPlan Chunk 6, N1 + N3). These replaced five duplicated inline
// filter blocks across calendar.js and portal.js.

import { describe, it, expect } from 'vitest';
import { buildCalendarEventFilters, buildPortalCalendarFilters } from '../utils/eventFilters.js';

describe('buildCalendarEventFilters', () => {
  it('returns an empty WHERE clause and no params when nothing is supplied', () => {
    const { where, params } = buildCalendarEventFilters({});
    expect(where).toBe('');
    expect(params).toEqual([]);
  });

  it('builds date-range conditions with ::date casts and sequential placeholders', () => {
    const { where, params } = buildCalendarEventFilters({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(where).toBe('WHERE ge.event_date >= $1::date AND ge.event_date <= $2::date');
    expect(params).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('applies venue, group and event-type filters', () => {
    const { where, params } = buildCalendarEventFilters({
      venueId: 'v1',
      groupId: 'g1',
      eventTypeId: 'et1',
    });
    expect(where).toBe('WHERE ge.venue_id = $1 AND ge.group_id = $2 AND ge.event_type_id = $3');
    expect(params).toEqual(['v1', 'g1', 'et1']);
  });

  it('uses groupsOnly only when no explicit groupId is given', () => {
    const both = buildCalendarEventFilters({ groupId: 'g1', groupsOnly: 'true' });
    expect(both.where).toBe('WHERE ge.group_id = $1');
    expect(both.params).toEqual(['g1']);

    const onlyFlag = buildCalendarEventFilters({ groupsOnly: 'true' });
    expect(onlyFlag.where).toBe('WHERE ge.group_id IS NOT NULL');
    expect(onlyFlag.params).toEqual([]);
  });

  it('scopes by member via the own-groups-or-open-meeting subquery', () => {
    const { where, params } = buildCalendarEventFilters({ memberId: 'm1' });
    expect(where).toContain('ge.group_id IS NULL OR ge.group_id IN');
    expect(where).toContain('member_id = $1');
    expect(params).toEqual(['m1']);
  });

  it('treats empty-string params as absent', () => {
    const { where, params } = buildCalendarEventFilters({ from: '', to: '', venueId: '' });
    expect(where).toBe('');
    expect(params).toEqual([]);
  });

  it('rejects a malformed date so it 422s at the edge rather than 500-ing in SQL', () => {
    expect(() => buildCalendarEventFilters({ from: '01/01/2026' })).toThrow();
    expect(() => buildCalendarEventFilters({ to: 'not-a-date' })).toThrow();
  });
});

describe('buildPortalCalendarFilters', () => {
  it('returns an empty WHERE clause when no filters and filter=all', () => {
    expect(buildPortalCalendarFilters({}, 'm1').where).toBe('');
    expect(buildPortalCalendarFilters({ filter: 'all' }, 'm1').where).toBe('');
  });

  it('filter=own scopes to the member own groups plus open meetings', () => {
    const { where, params } = buildPortalCalendarFilters({ filter: 'own' }, 'm1');
    expect(where).toContain('ge.group_id IS NULL OR ge.group_id IN');
    expect(params).toEqual(['m1']);
  });

  it('filter=other restricts to non-group events, optionally by event type', () => {
    const noType = buildPortalCalendarFilters({ filter: 'other' }, 'm1');
    expect(noType.where).toBe('WHERE ge.group_id IS NULL');
    expect(noType.params).toEqual([]);

    const withType = buildPortalCalendarFilters({ filter: 'other', eventTypeId: 'et1' }, 'm1');
    expect(withType.where).toBe('WHERE ge.group_id IS NULL AND ge.event_type_id = $1');
    expect(withType.params).toEqual(['et1']);
  });

  it('falls back to a plain groupId filter when no filter mode is set', () => {
    const { where, params } = buildPortalCalendarFilters({ groupId: 'g1' }, 'm1');
    expect(where).toBe('WHERE ge.group_id = $1');
    expect(params).toEqual(['g1']);
  });

  it('combines a date range with the member scope', () => {
    const { where, params } = buildPortalCalendarFilters(
      { from: '2026-01-01', filter: 'own' },
      'm1',
    );
    expect(where).toBe(
      'WHERE ge.event_date >= $1::date AND (ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $2))',
    );
    expect(params).toEqual(['2026-01-01', 'm1']);
  });

  it('rejects an unknown filter value', () => {
    expect(() => buildPortalCalendarFilters({ filter: 'bogus' }, 'm1')).toThrow();
  });
});
