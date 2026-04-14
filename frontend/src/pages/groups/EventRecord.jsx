// beacon2/frontend/src/pages/groups/EventRecord.jsx
// Event Record page — tabbed view for a single event (details / members / financials).

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import EventMembers from '../../components/EventMembers.jsx';
import EventFinancials from '../../components/EventFinancials.jsx';
import RecordTimestamp from '../../components/RecordTimestamp.jsx';
import { calendar } from '../../lib/api.js';

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}
function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

export default function EventRecord() {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenant, can, hasFeature } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeTab = searchParams.get('tab') || 'details';

  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ev = await calendar.getEvent(eventId);
      setEvent(ev);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const navLinks = [
    { label: 'Calendar', to: '/calendar' },
    ...(event?.group_id ? [{ label: event.group_name || 'Group', to: `/groups/${event.group_id}` }] : []),
  ];

  const tabs = [
    { key: 'details',    label: 'Details',    available: true },
    { key: 'members',    label: 'Members',    available: hasFeature('eventAttendance') && can('event_attendance', 'view') },
    { key: 'financials', label: 'Financials', available: can('event_finance', 'view') },
  ];

  if (loading) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={[{ label: 'Calendar', to: '/calendar' }]} />
        <div className="max-w-4xl mx-auto px-4 py-4">
          <p className="text-slate-500 text-sm">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen pb-10">
        <PageHeader tenant={tenant} />
        <NavBar links={[{ label: 'Calendar', to: '/calendar' }]} />
        <div className="max-w-4xl mx-auto px-4 py-4">
          <p className="text-red-600 text-sm">{error || 'Event not found.'}</p>
        </div>
      </div>
    );
  }

  const title = event.topic || event.group_name || event.event_type_name || 'Event';

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-1">{title}</h1>
        <p className="text-sm text-slate-500 text-center mb-3">
          {fmtDate(event.event_date)}
          {event.start_time ? ` ${fmtTime(event.start_time)}` : ''}
          {event.end_time ? ` – ${fmtTime(event.end_time)}` : ''}
        </p>

        {/* Tab navigation */}
        <div role="tablist" className="flex gap-0 mb-4 border-b border-slate-300">
          {tabs.filter((t) => t.available).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setSearchParams(tab.key === 'details' ? {} : { tab: tab.key })}
              className={[
                'px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white/90 rounded-lg shadow-sm p-4 sm:p-6">
          {activeTab === 'details' && (
            <EventDetails event={event} />
          )}
          {activeTab === 'members' && (
            <EventMembers eventId={eventId} groupId={event.group_id} />
          )}
          {activeTab === 'financials' && (
            <EventFinancials eventId={eventId} />
          )}
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}

function EventDetails({ event }) {
  const e = event;
  const fieldCls = 'text-sm text-slate-900';
  const labelCls = 'text-sm font-medium text-slate-500';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className={labelCls}>Date</p>
          <p className={fieldCls}>{fmtDate(e.event_date)}</p>
        </div>
        <div>
          <p className={labelCls}>Time</p>
          <p className={fieldCls}>
            {fmtTime(e.start_time) || '—'}
            {e.end_time ? ` – ${fmtTime(e.end_time)}` : ''}
          </p>
        </div>
        {e.group_id && (
          <div>
            <p className={labelCls}>Group</p>
            <p className={fieldCls}>
              <Link to={`/groups/${e.group_id}`} className="text-blue-700 hover:underline">
                {e.group_name}
              </Link>
            </p>
          </div>
        )}
        {e.event_type_name && (
          <div>
            <p className={labelCls}>Event type</p>
            <p className={fieldCls}>{e.event_type_name}</p>
          </div>
        )}
        {e.venue_name && (
          <div>
            <p className={labelCls}>Venue</p>
            <p className={fieldCls}>
              {e.venue_name}
              {e.venue_postcode ? ` (${e.venue_postcode})` : ''}
            </p>
          </div>
        )}
        {e.topic && (
          <div>
            <p className={labelCls}>Topic</p>
            <p className={fieldCls}>{e.topic}</p>
          </div>
        )}
        {e.contact && (
          <div>
            <p className={labelCls}>Enquiries</p>
            <p className={fieldCls}>{e.contact}</p>
          </div>
        )}
        <div>
          <p className={labelCls}>Members</p>
          <p className={fieldCls}>{e.member_count ?? 0}</p>
        </div>
      </div>
      {e.details && (
        <div>
          <p className={labelCls}>Details</p>
          <p className={`${fieldCls} whitespace-pre-wrap`}>{e.details}</p>
        </div>
      )}
      <RecordTimestamp created={e.created_at} updated={e.updated_at} />
    </div>
  );
}
