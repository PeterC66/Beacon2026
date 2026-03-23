// beacon2/frontend/src/pages/groups/Calendar.jsx
// Calendar — chronological list of all group events + open meetings.

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { calendar as calendarApi, venues as venuesApi, groups as groupsApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

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
  const [groupList, setGroupList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Filters
  const [from,       setFrom]       = useState(defaultFrom);
  const [to,         setTo]         = useState(defaultTo);
  const [filterMode, setFilterMode] = useState('all'); // all | member | venue | group
  const [memberId,   setMemberId]   = useState('');
  const [venueId,    setVenueId]    = useState('');
  const [groupId,    setGroupId]    = useState('');

  // Member search autocomplete
  const [memberQuery,   setMemberQuery]   = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberLabel,   setMemberLabel]   = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const searchTimeout = useRef(null);
  const dropdownRef   = useRef(null);

  // Load venues and groups for dropdowns
  useEffect(() => {
    venuesApi.list().then(setVenueList).catch(() => {});
    groupsApi.list({ activeOnly: false }).then(setGroupList).catch(() => {});
  }, []);

  // Load events when filters change
  useEffect(() => {
    loadEvents();
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
      await calendarApi.downloadPdf(params);
    } catch (err) {
      setError(err.message);
    }
  }

  const canViewMeetings = can('meetings', 'view');
  const inputCls = 'border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  const navLinks = [
    { label: 'Home',   to: '/' },
    { label: 'Groups', to: '/groups' },
    ...(canViewMeetings ? [{ label: 'Open Meetings', to: '/calendar/open-meetings' }] : []),
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
                onChange={() => { setFilterMode('all'); clearMember(); }} />
              all
            </label>

            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" name="filter" value="member" checked={filterMode === 'member'}
                onChange={() => { setFilterMode('member'); setVenueId(''); setGroupId(''); }} />
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
                onChange={() => { setFilterMode('venue'); clearMember(); setGroupId(''); }} />
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
                onChange={() => { setFilterMode('group'); clearMember(); setVenueId(''); }} />
              group
            </label>
            {filterMode === 'group' && (
              <select className={inputCls} name="groupId" value={groupId}
                onChange={(e) => setGroupId(e.target.value)}>
                <option value="">— select group —</option>
                {groupList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
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

        {/* Events table */}
        {loading ? (
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
                            <span className="italic text-slate-500">Open Meeting</span>
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
        )}

        {/* Bottom actions */}
        {!loading && events.length > 0 && (
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
          {canViewMeetings && (
            <>
              <span className="text-slate-400">-</span>
              <Link to="/calendar/open-meetings" className="text-blue-700 hover:underline">Open Meetings</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
