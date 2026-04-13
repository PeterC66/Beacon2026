// beacon2/frontend/src/pages/groups/Calendar.jsx
// Calendar — chronological list of all group/team events + non-group events.

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { calendar as calendarApi, venues as venuesApi, groups as groupsApi, teams as teamsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';

function defaultFrom() {
  return new Date().toISOString().slice(0, 10);
}

function defaultTo() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  const dt = new Date(+y, +m - 1, +day);
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()];
  return `${dayName} ${+day} ${monthName} ${y}`;
}

function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

function googleMapsUrl(postcode) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(postcode)}`;
}

export default function Calendar() {
  const { can, tenant } = useAuth();

  const [events,    setEvents]    = useState([]);
  const [venueList, setVenueList] = useState([]);
  const [groupTeamList, setGroupTeamList] = useState([]);
  const [eventTypeList, setEventTypeList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Filters
  const [from,       setFrom]       = useState(defaultFrom);
  const [to,         setTo]         = useState(defaultTo);
  const [filterMode, setFilterMode] = useState('all'); // all | member | venue | group | other
  const [memberId,   setMemberId]   = useState('');
  const [venueId,    setVenueId]    = useState('');
  const [groupId,    setGroupId]    = useState('');
  const [eventTypeId, setEventTypeId] = useState('');

  // Member search autocomplete
  const [memberQuery,   setMemberQuery]   = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberLabel,   setMemberLabel]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const searchTimeout = useRef(null);
  const dropdownRef   = useRef(null);

  // "Other" mode — event management
  const [otherEvents, setOtherEvents] = useState([]);
  const [otherLoading, setOtherLoading] = useState(false);
  const [otherSelected, setOtherSelected] = useState(new Set());
  const EMPTY_EV = {
    eventDate: '', startTime: '', endTime: '', venueId: '',
    topic: '', contact: '', details: '', isPrivate: false,
    repeatEvery: '', repeatUnit: 'weeks', repeatUntil: '',
  };
  const [addForm, setAddForm] = useState(EMPTY_EV);
  const [addError, setAddError] = useState(null);
  const [addSaving, setAddSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const canManage = can('meetings', 'create') || can('meetings', 'change');
  const canViewMeetings = can('meetings', 'view');

  // Load venues, groups+teams, and event types for dropdowns
  useEffect(() => {
    venuesApi.list().then(setVenueList).catch(() => {});
    Promise.all([
      groupsApi.list({ activeOnly: false }),
      teamsApi.list({ activeOnly: false }),
    ]).then(([groups, teams]) => {
      const combined = [
        ...groups.map((g) => ({ ...g, type: 'group' })),
        ...teams.map((t) => ({ ...t, type: 'team' })),
      ].sort((a, b) => a.name.localeCompare(b.name));
      setGroupTeamList(combined);
    }).catch(() => {});
    calendarApi.listEventTypes().then(setEventTypeList).catch(() => {});
  }, []);

  // Load events when calendar filters change (not for "other" mode)
  useEffect(() => {
    if (filterMode !== 'other') loadEvents();
  }, [from, to, filterMode, memberId, venueId, groupId]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadEvents() {
    setLoading(true);
    setError(null);
    try {
      const params = { from, to };
      if (filterMode === 'member' && memberId) params.memberId = memberId;
      if (filterMode === 'venue'  && venueId)  params.venueId  = venueId;
      if (filterMode === 'group'  && groupId)  params.groupId  = groupId;
      const data = await calendarApi.listEvents(params);
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── "Other" mode helpers ─────────────────────────────────────────────────

  async function loadOtherEvents(typeId) {
    setOtherLoading(true);
    setError(null);
    try {
      const data = await calendarApi.listOpenEvents(typeId ? { eventTypeId: typeId } : {});
      setOtherEvents(data);
      setOtherSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setOtherLoading(false);
    }
  }

  // Load other events when switching to "other" mode or changing event type
  useEffect(() => {
    if (filterMode === 'other' && eventTypeId) loadOtherEvents(eventTypeId);
  }, [filterMode, eventTypeId]);

  // Auto-select first event type when entering "other" mode
  useEffect(() => {
    if (filterMode === 'other' && !eventTypeId && eventTypeList.length > 0) {
      setEventTypeId(eventTypeList[0].id);
    }
  }, [filterMode, eventTypeList]);

  function setAdd(field, value) {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addForm.eventDate) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const payload = {
        eventDate:   addForm.eventDate,
        startTime:   addForm.startTime || null,
        endTime:     addForm.endTime || null,
        venueId:     addForm.venueId || null,
        topic:       addForm.topic || null,
        contact:     addForm.contact || null,
        details:     addForm.details || null,
        isPrivate:   addForm.isPrivate,
        eventTypeId: eventTypeId || null,
      };
      if (addForm.repeatEvery && addForm.repeatUntil) {
        payload.repeatEvery = parseInt(addForm.repeatEvery, 10);
        payload.repeatUnit  = addForm.repeatUnit;
        payload.repeatUntil = addForm.repeatUntil;
      }
      await calendarApi.createOpenEvents(payload);
      setAddForm(EMPTY_EV);
      await loadOtherEvents(eventTypeId);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  function normaliseTime(t) {
    if (!t) return '';
    const s = String(t);
    const tIdx = s.indexOf('T');
    if (tIdx !== -1) return s.slice(tIdx + 1, tIdx + 6);
    return s.slice(0, 5);
  }

  function startEdit(ev) {
    setEditId(ev.id);
    setEditForm({
      eventDate: ev.event_date ? String(ev.event_date).slice(0, 10) : '',
      startTime: normaliseTime(ev.start_time),
      endTime:   normaliseTime(ev.end_time),
      venueId:   ev.venue_id ?? '',
      topic:     ev.topic ?? '',
      contact:   ev.contact ?? '',
      details:   ev.details ?? '',
      isPrivate: ev.is_private ?? false,
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({});
    setEditError(null);
  }

  async function handleSaveEdit(evId) {
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = {
        eventDate: editForm.eventDate || undefined,
        startTime: editForm.startTime || null,
        endTime:   editForm.endTime || null,
        venueId:   editForm.venueId || null,
        topic:     editForm.topic || null,
        contact:   editForm.contact || null,
        details:   editForm.details || null,
        isPrivate: editForm.isPrivate,
      };
      await calendarApi.updateOpenEvent(evId, payload);
      cancelEdit();
      await loadOtherEvents(eventTypeId);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  function toggleOtherSelect(id) {
    setOtherSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (otherSelected.size === 0) return;
    if (!window.confirm(`Delete ${otherSelected.size} event(s)?`)) return;
    try {
      await calendarApi.deleteOpenEvents([...otherSelected]);
      await loadOtherEvents(eventTypeId);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleMemberSearch(q) {
    setMemberQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) {
      setMemberResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await calendarApi.searchMembers(q);
        setMemberResults(results);
        setShowDropdown(true);
      } catch { /* ignore */ }
    }, 300);
  }

  function selectMember(m) {
    setMemberId(m.id);
    setMemberLabel(`${m.last_name}, ${m.first_name}`);
    setMemberQuery(`${m.last_name}, ${m.first_name}`);
    setShowDropdown(false);
    setMemberResults([]);
  }

  function clearMember() {
    setMemberId('');
    setMemberLabel('');
    setMemberQuery('');
    setMemberResults([]);
  }

  async function handleDownloadPdf() {
    try {
      const params = { from, to };
      if (filterMode === 'member' && memberId) params.memberId = memberId;
      if (filterMode === 'venue'  && venueId)  params.venueId  = venueId;
      if (filterMode === 'group'  && groupId)  params.groupId  = groupId;
      if (filterMode === 'other'  && eventTypeId) params.eventTypeId = eventTypeId;
      await calendarApi.downloadPdf(params);
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  const navLinks = [
    { label: 'Home',   to: '/' },
    { label: 'Groups', to: '/groups' },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 mt-4 space-y-4">
        <h1 className="text-xl font-bold text-center">Calendar</h1>

        {/* Filter controls */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 space-y-3">
          {/* Row 1: Radio buttons + filter value */}
          <div className="flex flex-wrap gap-4 items-center text-sm">
            <span className="font-medium text-slate-700">Show:</span>

            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="filter" value="all" checked={filterMode === 'all'}
                onChange={() => { setFilterMode('all'); clearMember(); setEventTypeId(''); }} />
              all
            </label>

            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="filter" value="member" checked={filterMode === 'member'}
                onChange={() => { setFilterMode('member'); setVenueId(''); setGroupId(''); setEventTypeId(''); }} />
              for member
            </label>
            {filterMode === 'member' && (
              <div className="relative" ref={dropdownRef}>
                <input
                  type="text"
                  name="memberQuery"
                  className={inputCls + ' w-56'}
                  placeholder="Search member name..."
                  value={memberQuery}
                  onChange={(e) => handleMemberSearch(e.target.value)}
                  onFocus={() => { if (memberResults.length > 0) setShowDropdown(true); }}
                />
                {memberLabel && (
                  <button onClick={clearMember} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-xs">
                    x
                  </button>
                )}
                {showDropdown && memberResults.length > 0 && (
                  <ul className="absolute z-20 top-full left-0 mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-48 overflow-y-auto w-64">
                    {memberResults.map((m) => (
                      <li key={m.id}
                        className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer"
                        onMouseDown={() => selectMember(m)}>
                        {m.last_name}, {m.first_name} {m.member_no ? `(${m.member_no})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="filter" value="venue" checked={filterMode === 'venue'}
                onChange={() => { setFilterMode('venue'); clearMember(); setGroupId(''); setEventTypeId(''); }} />
              venue
            </label>
            {filterMode === 'venue' && (
              <select className={inputCls} name="venueId" value={venueId}
                onChange={(e) => setVenueId(e.target.value)}>
                <option value="">— select venue —</option>
                {venueList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}

            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="filter" value="group" checked={filterMode === 'group'}
                onChange={() => { setFilterMode('group'); clearMember(); setVenueId(''); setEventTypeId(''); }} />
              group/team
            </label>
            {filterMode === 'group' && (
              <select className={inputCls} name="groupId" value={groupId}
                onChange={(e) => setGroupId(e.target.value)}>
                <option value="">— select group/team —</option>
                {groupTeamList.map((g) => <option key={g.id} value={g.id}>{g.name}{g.type === 'team' ? ' (team)' : ''}</option>)}
              </select>
            )}

            {canViewMeetings && (
              <>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="filter" value="other" checked={filterMode === 'other'}
                    onChange={() => { setFilterMode('other'); clearMember(); setVenueId(''); setGroupId(''); }} />
                  other
                </label>
                {filterMode === 'other' && (
                  <select className={inputCls} name="eventTypeId" value={eventTypeId}
                    onChange={(e) => setEventTypeId(e.target.value)}>
                    {eventTypeList.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Row 2: Date range + Show Detail */}
          <div className="flex flex-wrap gap-4 items-center text-sm">
            <label className="flex items-center gap-1">
              From
              <input type="date" name="from" className={inputCls} value={from}
                onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex items-center gap-1">
              To
              <input type="date" name="to" className={inputCls} value={to}
                onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer ml-auto">
              <input type="checkbox" className={cbCls} checked={showDetail}
                onChange={(e) => setShowDetail(e.target.checked)} />
              Show Detail
            </label>
          </div>
        </div>

        {/* Error / Loading */}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* ── "Other" mode: event management ──────────────────────────── */}
        {filterMode === 'other' && eventTypeId && (
          <>
            {otherLoading ? (
              <p className="text-center text-slate-500 py-8">Loading...</p>
            ) : (
              <>
                {/* Event count + Show Detail */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">
                    {otherEvents.length} event{otherEvents.length !== 1 ? 's' : ''}
                  </h2>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className={cbCls} checked={showDetail}
                      onChange={(e) => setShowDetail(e.target.checked)} />
                    Show Detail
                  </label>
                </div>

                {/* Bulk actions */}
                {canManage && otherEvents.length > 0 && (
                  <div className="flex gap-3 items-center text-sm">
                    <button onClick={() => setOtherSelected(new Set(otherEvents.map((e) => e.id)))}
                      className="text-blue-600 hover:underline text-xs">Select all</button>
                    <button onClick={() => setOtherSelected(new Set())}
                      className="text-slate-500 hover:underline text-xs">Deselect all</button>
                    {otherSelected.size > 0 && (
                      <button onClick={handleDeleteSelected}
                        className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-3 py-1 text-xs">
                        Delete selected ({otherSelected.size})
                      </button>
                    )}
                  </div>
                )}

                {/* Events table */}
                {otherEvents.length === 0 ? (
                  <p className="text-slate-500 text-sm">No events scheduled for this type.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg shadow-sm">
                    <table className="w-full text-sm bg-white min-w-max">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                          {canManage && <th className="px-3 py-2 w-8"></th>}
                          <th className="px-3 py-2 font-normal">Date &amp; Time</th>
                          <th className="px-3 py-2 font-normal">Until</th>
                          <th className="px-3 py-2 font-normal">Venue</th>
                          <th className="px-3 py-2 font-normal">Topic</th>
                          <th className="px-3 py-2 font-normal">Enquiries</th>
                          {canManage && <th className="px-3 py-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {otherEvents.map((ev, idx) => {
                          const rowBg = idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white';
                          const dataColSpan = 5;
                          if (editId === ev.id) {
                            return renderEditRow(ev, dataColSpan, rowBg);
                          }
                          return renderEventRow(ev, idx, rowBg);
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add new event form */}
                {canManage && renderAddForm()}
              </>
            )}
          </>
        )}

        {/* ── Calendar table (all/member/venue/group modes) ────────── */}
        {filterMode !== 'other' && (loading ? (
          <p className="text-center text-slate-500 py-8">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No events found for the selected period.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-sm">
            <table className="w-full text-sm bg-white min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                  <th className="px-3 py-2 font-normal">Date &amp; Time</th>
                  <th className="px-3 py-2 font-normal">Until</th>
                  <th className="px-3 py-2 font-normal">Group</th>
                  <th className="px-3 py-2 font-normal">Venue</th>
                  <th className="px-3 py-2 font-normal">Topic</th>
                  <th className="px-3 py-2 font-normal">Enquiries</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => {
                  const rowBg = i % 2 === 0 ? 'bg-yellow-50' : 'bg-white';
                  return (
                    <>
                      <tr key={ev.id} className={`border-b border-slate-100 ${rowBg}`}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {ev.group_id ? (
                            <Link
                              to={`/groups/${ev.group_id}?tab=schedule`}
                              className="text-blue-700 hover:underline"
                            >
                              {fmtDate(ev.event_date)}
                              {ev.start_time ? ` ${fmtTime(ev.start_time)}` : ''}
                            </Link>
                          ) : (
                            <span>
                              {fmtDate(ev.event_date)}
                              {ev.start_time ? ` ${fmtTime(ev.start_time)}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {fmtTime(ev.end_time)}
                        </td>
                        <td className="px-3 py-2">
                          {ev.group_id ? (
                            <Link to={`/groups/${ev.group_id}`} className="text-blue-700 hover:underline">
                              {ev.group_name}
                            </Link>
                          ) : (
                            <span className="italic text-slate-500">{ev.event_type_name || 'Open Meeting'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {ev.venue_name && ev.venue_id ? (
                            <>
                              <Link to={`/venues/${ev.venue_id}`} className="text-blue-700 hover:underline">
                                {ev.venue_name}
                              </Link>
                              {ev.venue_postcode && (
                                <>
                                  {' - '}
                                  <a href={googleMapsUrl(ev.venue_postcode)}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-xs">
                                    map
                                  </a>
                                </>
                              )}
                            </>
                          ) : ''}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{ev.topic ?? ''}</td>
                        <td className="px-3 py-2 text-slate-600">{ev.contact ?? ''}</td>
                      </tr>
                      {showDetail && ev.details && (
                        <tr key={`${ev.id}-detail`} className={rowBg}>
                          <td colSpan={6} className="px-3 pb-2 pt-0 text-xs text-slate-500 italic">
                            {ev.details}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 text-left text-slate-600 italic font-normal">
                  <th className="px-3 py-2 font-normal">Date &amp; Time</th>
                  <th className="px-3 py-2 font-normal">Until</th>
                  <th className="px-3 py-2 font-normal">Group</th>
                  <th className="px-3 py-2 font-normal">Venue</th>
                  <th className="px-3 py-2 font-normal">Topic</th>
                  <th className="px-3 py-2 font-normal">Enquiries</th>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

        {/* Bottom actions */}
        {!loading && ((filterMode !== 'other' && events.length > 0) || (filterMode === 'other' && otherEvents.length > 0)) && (
          <div className="flex justify-center gap-4">
            {can('calendar', 'download') && (
              <button onClick={handleDownloadPdf}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                Download PDF
              </button>
            )}
          </div>
        )}

        {/* Bottom nav */}
        <div className="text-center text-sm space-x-4 pt-2">
          <Link to="/" className="text-blue-700 hover:underline">Home</Link>
          <span className="text-slate-400">-</span>
          <Link to="/groups" className="text-blue-700 hover:underline">Groups</Link>
        </div>
      </div>
    </div>
  );

  // ── Render helpers (plain functions, not components) ──────────────────────

  function renderEventRow(ev, idx, rowBg) {
    return (
      <>
        <tr key={ev.id} className={`border-b border-slate-100 ${rowBg}`}>
          {canManage && (
            <td className="px-3 py-2">
              <input type="checkbox" className={cbCls}
                checked={otherSelected.has(ev.id)}
                onChange={() => toggleOtherSelect(ev.id)} />
            </td>
          )}
          <td className="px-3 py-2">
            {canManage ? (
              <button onClick={() => startEdit(ev)}
                className="text-blue-700 hover:underline text-left whitespace-nowrap">
                {fmtDate(ev.event_date)}
                {ev.start_time ? ` ${normaliseTime(ev.start_time)}` : ''}
              </button>
            ) : (
              <span className="whitespace-nowrap">
                {fmtDate(ev.event_date)}
                {ev.start_time ? ` ${normaliseTime(ev.start_time)}` : ''}
              </span>
            )}
            {ev.is_private && <span className="ml-2 text-xs text-slate-400">(private)</span>}
          </td>
          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{normaliseTime(ev.end_time)}</td>
          <td className="px-3 py-2 text-slate-600">{ev.venue_name ?? ''}</td>
          <td className="px-3 py-2 text-slate-700">{ev.topic ?? ''}</td>
          <td className="px-3 py-2 text-slate-600">{ev.contact ?? ''}</td>
          {canManage && <td className="px-3 py-2"></td>}
        </tr>
        {showDetail && ev.details && (
          <tr key={`${ev.id}-detail`} className={rowBg}>
            {canManage && <td></td>}
            <td colSpan={5} className="px-3 pb-2 pt-0 text-xs text-slate-500 italic">{ev.details}</td>
            {canManage && <td></td>}
          </tr>
        )}
      </>
    );
  }

  function renderEditRow(ev, dataColSpan, rowBg) {
    return (
      <tr key={ev.id} className="border-b border-slate-100 bg-blue-50">
        {canManage && <td className="px-3 py-2"></td>}
        <td className="px-3 py-2" colSpan={dataColSpan + (canManage ? 1 : 0)}>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className={labelCls}>Date <RequiredMark /></label>
              <input type="date" name="eventDate" className={inputCls} value={editForm.eventDate}
                onChange={(e) => setEditForm((p) => ({ ...p, eventDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Start</label>
              <input type="time" step="900" name="startTime" className={inputCls} value={editForm.startTime}
                onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Until</label>
              <input type="time" step="900" name="endTime" className={inputCls} value={editForm.endTime}
                onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Venue</label>
              <select name="venueId" className={inputCls} value={editForm.venueId}
                onChange={(e) => setEditForm((p) => ({ ...p, venueId: e.target.value }))}>
                <option value="">-- none --</option>
                {venueList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="min-w-40">
              <label className={labelCls}>Topic</label>
              <input name="topic" className={`${inputCls} w-full`} value={editForm.topic}
                onChange={(e) => setEditForm((p) => ({ ...p, topic: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Enquiries</label>
              <input name="contact" className={inputCls} value={editForm.contact}
                onChange={(e) => setEditForm((p) => ({ ...p, contact: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-48">
              <label className={labelCls}>Details</label>
              <input name="details" className={`${inputCls} w-full`} value={editForm.details}
                onChange={(e) => setEditForm((p) => ({ ...p, details: e.target.value }))} />
            </div>
            <label className="flex items-center gap-1 text-xs cursor-pointer mt-4">
              <input type="checkbox" className={cbCls} checked={editForm.isPrivate}
                onChange={(e) => setEditForm((p) => ({ ...p, isPrivate: e.target.checked }))} />
              Private
            </label>
          </div>
          {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleSaveEdit(ev.id)} disabled={editSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1 text-xs">
              {editSaving ? 'Saving...' : 'Update'}
            </button>
            <button onClick={cancelEdit}
              className="border border-slate-300 rounded px-3 py-1 text-xs hover:bg-slate-50">Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  function renderAddForm() {
    return (
      <div className="bg-white/90 rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Events</h3>
        {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}
        <form onSubmit={handleAdd} noValidate className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className={labelCls}>First date and time <RequiredMark /></label>
              <input type="date" name="eventDate" className={inputCls} required value={addForm.eventDate}
                onChange={(e) => setAdd('eventDate', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Start time</label>
              <input type="time" step="900" name="startTime" className={inputCls} value={addForm.startTime}
                onChange={(e) => setAdd('startTime', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End time</label>
              <input type="time" step="900" name="endTime" className={inputCls} value={addForm.endTime}
                onChange={(e) => setAdd('endTime', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Venue</label>
              <select name="venueId" className={inputCls} value={addForm.venueId}
                onChange={(e) => setAdd('venueId', e.target.value)}>
                <option value="">-- none --</option>
                {venueList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-40 flex-1">
              <label className={labelCls}>Topic</label>
              <input name="topic" className={`${inputCls} w-full`} value={addForm.topic}
                onChange={(e) => setAdd('topic', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Enquiries</label>
              <input name="contact" className={inputCls} value={addForm.contact}
                onChange={(e) => setAdd('contact', e.target.value)} />
            </div>
            <div className="flex-1 min-w-48">
              <label className={labelCls}>Details</label>
              <input name="details" className={`${inputCls} w-full`} value={addForm.details}
                onChange={(e) => setAdd('details', e.target.value)} />
            </div>
            <label className="flex items-center gap-1 text-xs cursor-pointer mt-4">
              <input type="checkbox" className={cbCls} checked={addForm.isPrivate}
                onChange={(e) => setAdd('isPrivate', e.target.checked)} />
              Exclude from public calendar
            </label>
          </div>
          {/* Recurrence */}
          <div className="flex flex-wrap gap-3 items-end border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-600 self-end pb-2">then every</span>
            <div>
              <label className={labelCls}>Count</label>
              <input type="number" min="1" name="repeatEvery" className={`${inputCls} w-20`} value={addForm.repeatEvery}
                placeholder="--"
                onChange={(e) => setAdd('repeatEvery', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <select name="repeatUnit" className={inputCls} value={addForm.repeatUnit}
                onChange={(e) => setAdd('repeatUnit', e.target.value)}>
                <option value="days">days</option>
                <option value="weeks">weeks</option>
                <option value="months">months</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Not beyond</label>
              <input type="date" name="repeatUntil" className={inputCls} value={addForm.repeatUntil}
                onChange={(e) => setAdd('repeatUntil', e.target.value)} />
            </div>
          </div>
          <div className="pt-1">
            <button type="submit" disabled={addSaving || !addForm.eventDate}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
              {addSaving ? 'Adding...' : 'Add Events'}
            </button>
          </div>
        </form>
      </div>
    );
  }
}
