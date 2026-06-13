// beacon2/frontend/src/pages/calendar/CalendarMonthTable.jsx
// Read-only "calendar" view table (all/member/venue/group filter modes).
// Extracted from Calendar.jsx — no behaviour change.

import { Link } from 'react-router-dom';
import { fmtDateLong as fmtDate, fmtTime } from '../../lib/dateFormatters.js';
import { googleMapsUrl } from './calendarUtils.js';

export default function CalendarMonthTable({ events, loading, showDetail }) {
  if (loading) return <p className="text-center text-slate-500 py-8">Loading...</p>;
  if (events.length === 0)
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        No events found for the selected period.
      </p>
    );
  return (
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
                    <Link
                      to={`/calendar/events/${ev.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {fmtDate(ev.event_date)}
                      {ev.start_time ? ` ${fmtTime(ev.start_time)}` : ''}
                    </Link>
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
                      <span className="italic text-slate-500">
                        {ev.event_type_name || 'Open Meeting'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {ev.venue_name && ev.venue_id ? (
                      <>
                        <Link
                          to={`/venues/${ev.venue_id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {ev.venue_name}
                        </Link>
                        {ev.venue_postcode && (
                          <>
                            {' - '}
                            <a
                              href={googleMapsUrl(ev.venue_postcode)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              map
                            </a>
                          </>
                        )}
                      </>
                    ) : (
                      ''
                    )}
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
  );
}
