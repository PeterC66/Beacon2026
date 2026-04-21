// beacon2/frontend/src/pages/calendar/EventRecord.jsx
// Event Record page — tabbed view for a single event (details / members / financials).
// The Details tab is the single editor for any event, regardless of origin:
//   - group event  (group_id set, group_type = 'group') → /groups/:gid/events/:id
//   - team event   (group_id set, group_type = 'team')  → /teams/:gid/events/:id
//   - open meeting (group_id NULL)                     → /calendar/open-events/:id

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';
import EventMembers from '../../components/EventMembers.jsx';
import EventFinancials from '../../components/EventFinancials.jsx';
import RecordTimestamp from '../../components/RecordTimestamp.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import { calendar, groups as groupsApi, teams as teamsApi, venues as venuesApi } from '../../lib/api.js';

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

  const isTeam = event?.group_type === 'team';
  const isGroup = event?.group_id && !isTeam;
  const isOpenMeeting = event && !event.group_id;

  const canEdit = event
    ? (event.group_id ? can('group_records_all', 'change') : can('meetings', 'change'))
    : false;

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Events', to: '/calendar' },
    ...(isTeam
      ? [{ label: event.group_name || 'Team', to: `/teams/${event.group_id}` }]
      : isGroup
        ? [{ label: event.group_name || 'Group', to: `/groups/${event.group_id}` }]
        : []),
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
        <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Events', to: '/calendar' }]} />
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
        <NavBar links={[{ label: 'Home', to: '/' }, { label: 'Events', to: '/calendar' }]} />
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
        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase text-center mb-1">Event</p>
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
            <EventDetails
              event={event}
              canEdit={canEdit}
              onUpdated={(updated) => setEvent((prev) => ({ ...prev, ...updated }))}
              onDeleted={() => { /* handled below via navigate */ }}
            />
          )}
          {activeTab === 'members' && (
            <EventMembers eventId={eventId} groupId={event.group_id} />
          )}
          {activeTab === 'financials' && (
            <EventFinancials eventId={eventId} />
          )}
        </div>

        <RecordTimestamp label="Event record" createdAt={event.created_at} updatedAt={event.updated_at} className="pt-3" />
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}

function EventDetails({ event, canEdit, onUpdated }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  useEffect(() => {
    if (editing && venues.length === 0) {
      venuesApi.list().then(setVenues).catch(() => {});
    }
  }, [editing, venues.length]);

  function startEdit() {
    setForm({
      eventDate: event.event_date ? String(event.event_date).slice(0, 10) : '',
      startTime: fmtTime(event.start_time),
      endTime:   fmtTime(event.end_time),
      venueId:   event.venue_id ?? '',
      topic:     event.topic ?? '',
      contact:   event.contact ?? '',
      details:   event.details ?? '',
      isPrivate: event.is_private ?? false,
    });
    setErrMsg(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setErrMsg(null);
  }

  function buildPayload() {
    return {
      eventDate: form.eventDate || undefined,
      startTime: form.startTime || null,
      endTime:   form.endTime || null,
      venueId:   form.venueId || null,
      topic:     form.topic || null,
      contact:   form.contact || null,
      details:   form.details || null,
      isPrivate: !!form.isPrivate,
    };
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErrMsg(null);
    try {
      const payload = buildPayload();
      const isTeam = event.group_type === 'team';
      let updated;
      if (event.group_id && isTeam) {
        updated = await teamsApi.updateEvent(event.group_id, event.id, payload);
      } else if (event.group_id) {
        updated = await groupsApi.updateEvent(event.group_id, event.id, payload);
      } else {
        updated = await calendar.updateOpenEvent(event.id, payload);
      }
      // Server returns the raw row; merge into local state so display updates.
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setErrMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    setSaving(true);
    setErrMsg(null);
    try {
      const isTeam = event.group_type === 'team';
      if (event.group_id && isTeam) {
        await teamsApi.deleteEvents(event.group_id, [event.id]);
      } else if (event.group_id) {
        await groupsApi.deleteEvents(event.group_id, [event.id]);
      } else {
        await calendar.deleteOpenEvents([event.id]);
      }
      navigate('/calendar');
    } catch (err) {
      setErrMsg(err.message);
      setSaving(false);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';
  const fieldCls = 'text-sm text-slate-900';
  const viewLabelCls = 'text-sm font-medium text-slate-500';

  if (editing) {
    return (
      <form onSubmit={handleSave} noValidate className="space-y-4">
        {errMsg && <p className="text-red-600 text-sm">{errMsg}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ev-date" className={labelCls}>Date <RequiredMark /></label>
            <input id="ev-date" name="eventDate" type="date" className={inputCls} required
              value={form.eventDate}
              onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="ev-start" className={labelCls}>Start</label>
              <input id="ev-start" name="startTime" type="time" step="900" className={`${inputCls} w-full`}
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label htmlFor="ev-end" className={labelCls}>Until</label>
              <input id="ev-end" name="endTime" type="time" step="900" className={`${inputCls} w-full`}
                value={form.endTime}
                onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
            </div>
          </div>
          <div>
            <label htmlFor="ev-venue" className={labelCls}>Venue</label>
            <select id="ev-venue" name="venueId" className={`${inputCls} w-full`}
              value={form.venueId}
              onChange={(e) => setForm((p) => ({ ...p, venueId: e.target.value }))}>
              <option value="">— none —</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ev-topic" className={labelCls}>Topic</label>
            <input id="ev-topic" name="topic" className={`${inputCls} w-full`}
              value={form.topic}
              onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="ev-contact" className={labelCls}>Enquiries</label>
            <input id="ev-contact" name="contact" className={`${inputCls} w-full`}
              value={form.contact}
              onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ev-details" className={labelCls}>Details</label>
            <textarea id="ev-details" name="details" rows={3} className={`${inputCls} w-full`}
              value={form.details}
              onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className={cbCls} checked={!!form.isPrivate}
              onChange={(e) => setForm((p) => ({ ...p, isPrivate: e.target.checked }))} />
            Exclude from public calendar
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving || !form.eventDate}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancelEdit} disabled={saving}
            className="border border-slate-300 rounded px-5 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const e = event;
  return (
    <div className="space-y-4">
      {errMsg && <p className="text-red-600 text-sm">{errMsg}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className={viewLabelCls}>Date</p>
          <p className={fieldCls}>{fmtDate(e.event_date)}</p>
        </div>
        <div>
          <p className={viewLabelCls}>Time</p>
          <p className={fieldCls}>
            {fmtTime(e.start_time) || '—'}
            {e.end_time ? ` – ${fmtTime(e.end_time)}` : ''}
          </p>
        </div>
        {e.group_id && (
          <div>
            <p className={viewLabelCls}>{e.group_type === 'team' ? 'Team' : 'Group'}</p>
            <p className={fieldCls}>
              <Link to={e.group_type === 'team' ? `/teams/${e.group_id}` : `/groups/${e.group_id}`}
                className="text-blue-700 hover:underline">
                {e.group_name}
              </Link>
            </p>
          </div>
        )}
        {e.event_type_name && (
          <div>
            <p className={viewLabelCls}>Event type</p>
            <p className={fieldCls}>{e.event_type_name}</p>
          </div>
        )}
        {e.venue_name && (
          <div>
            <p className={viewLabelCls}>Venue</p>
            <p className={fieldCls}>
              {e.venue_name}
              {e.venue_postcode ? ` (${e.venue_postcode})` : ''}
            </p>
          </div>
        )}
        {e.topic && (
          <div>
            <p className={viewLabelCls}>Topic</p>
            <p className={fieldCls}>{e.topic}</p>
          </div>
        )}
        {e.contact && (
          <div>
            <p className={viewLabelCls}>Enquiries</p>
            <p className={fieldCls}>{e.contact}</p>
          </div>
        )}
        <div>
          <p className={viewLabelCls}>Members</p>
          <p className={fieldCls}>{e.member_count ?? 0}</p>
        </div>
        {e.is_private && (
          <div>
            <p className={viewLabelCls}>Visibility</p>
            <p className={fieldCls}>Excluded from public calendar</p>
          </div>
        )}
      </div>
      {e.details && (
        <div>
          <p className={viewLabelCls}>Details</p>
          <p className={`${fieldCls} whitespace-pre-wrap`}>{e.details}</p>
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-3 border-t border-slate-200">
          <button onClick={startEdit}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium">
            Edit
          </button>
          <button onClick={handleDelete} disabled={saving}
            className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm font-medium">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
