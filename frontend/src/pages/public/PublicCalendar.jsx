// beacon2/frontend/src/pages/public/PublicCalendar.jsx
// Public (unauthenticated) calendar page.
// Visible to anyone with the URL. Fields controlled by calendar_config public flags.
// Shows all non-private events from today to end of year. No filters or download.

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { publicApi } from '../../lib/api.js';
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

export default function PublicCalendar() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const hideHeader = searchParams.get('hdr') === '0';

  const [events, setEvents] = useState([]);
  const [u3aName, setU3aName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Default date range: now to end of year
  const now = new Date();
  const fromDate = now.toISOString().slice(0, 10);
  const toDate = `${now.getFullYear()}-12-31`;

  useEffect(() => {
    async function load() {
      try {
        const data = await publicApi.getPublicCalendar(slug, { from: fromDate, to: toDate });
        setEvents(data.events || []);
        setU3aName(data.u3aName || slug);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <PortalVersion />
        <p className="text-slate-500">Loading calendar...</p>
      </div>
    );
  }

  // Determine which optional columns have data
  const hasTopic = events.some(e => e.topic);
  const hasVenue = events.some(e => e.venue);
  const hasContact = events.some(e => e.contact);
  const hasDetails = events.some(e => e.details);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 px-4 py-8">
      <PortalVersion />
      <div className="max-w-4xl mx-auto">
        {!hideHeader && (
          <h1 className="text-xl font-bold text-center text-slate-800 mb-4">
            {u3aName} — Calendar
          </h1>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-3 py-2 font-semibold text-slate-600">Date &amp; Time</th>
                <th className="px-3 py-2 font-semibold text-slate-600">Group</th>
                {hasTopic && <th className="px-3 py-2 font-semibold text-slate-600">Topic</th>}
                {hasVenue && <th className="px-3 py-2 font-semibold text-slate-600">Venue</th>}
                {hasContact && <th className="px-3 py-2 font-semibold text-slate-600">Enquiries</th>}
                {hasDetails && <th className="px-3 py-2 font-semibold text-slate-600">Details</th>}
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
                  {hasTopic && <td className="px-3 py-2">{ev.topic || ''}</td>}
                  {hasVenue && <td className="px-3 py-2">{ev.venue || ''}</td>}
                  {hasContact && <td className="px-3 py-2">{ev.contact || ''}</td>}
                  {hasDetails && <td className="px-3 py-2">{ev.details || ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {events.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No events found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
