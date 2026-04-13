// beacon2/frontend/src/pages/public/PortalCalendar.jsx
// Members Portal — view calendar of meetings and events (doc 10.2.3).

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { portalApi } from '../../lib/api.js';
import PortalVersion from '../../components/PortalVersion.jsx';

function fmtDateUK(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
  return `${days[dt.getDay()]} ${parseInt(day)}/${m}/${y}`;
}

function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  const raw = idx !== -1 ? s.slice(idx + 1, idx + 6) : s.slice(0, 5);
  const [h, min] = raw.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'pm' : 'am';
  const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${hr12}.${min} ${ampm}`;
}

export default function PortalCalendar() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [eventTypeList, setEventTypeList] = useState([]);
  const [canDownload, setCanDownload] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'own' | 'group' | 'other'
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Default date range: now to end of year
  const now = new Date();
  const fromDate = now.toISOString().slice(0, 10);
  const toDate = `${now.getFullYear()}-12-31`;

  useEffect(() => {
    loadCalendar();
  }, [slug, filter, selectedGroup, selectedEventType]);

  async function loadCalendar() {
    setLoading(true);
    try {
      const params = { from: fromDate, to: toDate };
      if (filter === 'own') {
        params.filter = 'own';
      } else if (filter === 'group' && selectedGroup) {
        params.groupId = selectedGroup;
      } else if (filter === 'other') {
        params.filter = 'other';
        if (selectedEventType) params.eventTypeId = selectedEventType;
      }
      // If filter === 'group' but no selectedGroup, show open meetings only
      if (filter === 'group' && !selectedGroup) {
        params.groupId = 'null'; // handled by backend as no-group filter
      }

      const data = await portalApi.getCalendar(slug, params);
      setEvents(data.events || []);
      setGroupList(data.groups || []);
      setEventTypeList(data.eventTypes || []);
      setCanDownload(data.canDownload ?? false);
      // Auto-select first event type if entering "other" mode
      if (filter === 'other' && !selectedEventType && (data.eventTypes || []).length > 0) {
        setSelectedEventType(data.eventTypes[0].id);
      }
    } catch (err) {
      if (err.message.includes('expired') || err.message.includes('401')) {
        navigate(`/public/${slug}/portal`, { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = { from: fromDate, to: toDate };
      if (filter === 'own') params.filter = 'own';
      else if (filter === 'group' && selectedGroup) params.groupId = selectedGroup;
      else if (filter === 'other') {
        params.filter = 'other';
        if (selectedEventType) params.eventTypeId = selectedEventType;
      }
      await portalApi.downloadCalendarPdf(slug, params);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <PortalVersion />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to={`/public/${slug}/portal/home`} className="text-sm text-blue-700 hover:underline">
            &larr; Members Portal
          </Link>
        </div>

        <h1 className="text-xl font-bold text-center text-slate-800 mb-4">
          Calendar
        </h1>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-white rounded-md p-3 shadow-sm">
          <span className="text-sm font-medium text-slate-600">Show:</span>

          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="calFilter"
              checked={filter === 'all'}
              onChange={() => { setFilter('all'); setSelectedGroup(''); setSelectedEventType(''); }}
            />
            All
          </label>

          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="calFilter"
              checked={filter === 'group'}
              onChange={() => { setFilter('group'); setSelectedEventType(''); }}
            />
            Group
          </label>

          {filter === 'group' && (
            <select
              name="groupFilter"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-sm"
            >
              <option value="">— select group —</option>
              {groupList.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="calFilter"
              checked={filter === 'own'}
              onChange={() => { setFilter('own'); setSelectedGroup(''); setSelectedEventType(''); }}
            />
            Own groups and general meetings
          </label>

          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="calFilter"
              checked={filter === 'other'}
              onChange={() => { setFilter('other'); setSelectedGroup(''); }}
            />
            Other
          </label>

          {filter === 'other' && eventTypeList.length > 0 && (
            <select
              name="eventTypeFilter"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-sm"
            >
              {eventTypeList.map((et) => (
                <option key={et.id} value={et.id}>{et.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading calendar...</p>
        ) : (
          <>
            <div className="bg-white rounded-md shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-600">Date &amp; Time</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Group</th>
                    {events.some(e => e.topic) && (
                      <th className="px-3 py-2 font-semibold text-slate-600">Topic</th>
                    )}
                    {events.some(e => e.venue) && (
                      <th className="px-3 py-2 font-semibold text-slate-600">Venue</th>
                    )}
                    {events.some(e => e.contact) && (
                      <th className="px-3 py-2 font-semibold text-slate-600">Enquiries</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmtDateUK(ev.eventDate)}{' '}
                        {ev.startTime && fmtTime(ev.startTime)}
                      </td>
                      <td className="px-3 py-2">{ev.groupName}</td>
                      {events.some(e => e.topic) && (
                        <td className="px-3 py-2">{ev.topic || ''}</td>
                      )}
                      {events.some(e => e.venue) && (
                        <td className="px-3 py-2">{ev.venue || ''}</td>
                      )}
                      {events.some(e => e.contact) && (
                        <td className="px-3 py-2">{ev.contact || ''}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {events.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No events found.</p>
              )}
            </div>

            {canDownload && events.length > 0 && (
              <div className="text-center mt-4">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 text-sm font-medium"
                >
                  {downloading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
