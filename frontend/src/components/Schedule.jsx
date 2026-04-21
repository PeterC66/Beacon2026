// beacon2/frontend/src/components/Schedule.jsx
// Shared schedule (events) component used by both GroupRecord and TeamRecord.
// Props:
//   entityId  — the group or team ID
//   api       — the API module (groups or teams), must have listEvents/createEvents/deleteEvents
//   privilege — privilege resource for canManage check (default: 'group_records_all')
//
// Editing a single event is done on the Event Record page (/calendar/events/:id),
// which handles Details / Members / Financials together.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { venues as venuesApi } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import RequiredMark from './RequiredMark.jsx';

function normaliseTime(t) {
  if (!t) return '';
  const s = String(t);
  const tIdx = s.indexOf('T');
  if (tIdx !== -1) return s.slice(tIdx + 1, tIdx + 6);
  return s.slice(0, 5);
}

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export default function Schedule({ entityId, api, privilege = 'group_records_all' }) {
  const { can } = useAuth();
  const [events,    setEvents]    = useState([]);
  const [venues,    setVenues]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());

  // Add-event form
  const EMPTY_EV = {
    eventDate: '', startTime: '', endTime: '', venueId: '',
    topic: '', contact: '', details: '', isPrivate: false,
    repeatEvery: '', repeatUnit: 'weeks', repeatUntil: '',
  };
  const [addForm,   setAddForm]   = useState(EMPTY_EV);
  const [addError,  setAddError]  = useState(null);
  const [addSaving, setAddSaving] = useState(false);

  const canManage = can(privilege, 'change');

  useEffect(() => {
    load();
    venuesApi.list().then(setVenues).catch(() => {});
  }, [entityId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listEvents(entityId);
      setEvents(data);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
      };
      if (addForm.repeatEvery && addForm.repeatUntil) {
        payload.repeatEvery = parseInt(addForm.repeatEvery, 10);
        payload.repeatUnit  = addForm.repeatUnit;
        payload.repeatUntil = addForm.repeatUntil;
      }
      await api.createEvents(entityId, payload);
      setAddForm(EMPTY_EV);
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(events.map((e) => e.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} event(s)?`)) return;
    try {
      await api.deleteEvents(entityId, [...selected]);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';

  if (loading) return <p className="text-center text-slate-500 py-8">Loading…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Show Detail toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className={cbCls} checked={showDetail}
            onChange={(e) => setShowDetail(e.target.checked)} />
          Show Detail
        </label>
      </div>

      {/* Bulk actions */}
      {canManage && events.length > 0 && (
        <div className="flex gap-3 items-center text-sm">
          <button onClick={selectAll}   className="text-blue-600 hover:underline text-xs">Select all</button>
          <button onClick={deselectAll} className="text-slate-500 hover:underline text-xs">Deselect all</button>
          {selected.size > 0 && (
            <button onClick={handleDeleteSelected}
              className="border border-red-300 text-red-600 hover:bg-red-50 rounded px-3 py-1 text-xs">
              Delete selected ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* Events table */}
      {events.length === 0 ? (
        <p className="text-slate-500 text-sm">No events scheduled yet.</p>
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
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const rowBg = i % 2 === 0 ? 'bg-yellow-50' : 'bg-white';
                const dataColSpan = 5;

                return (
                  <>
                    <tr key={ev.id} className={`border-b border-slate-100 ${rowBg}`}>
                      {canManage && (
                        <td className="px-3 py-2">
                          <input type="checkbox" className={cbCls}
                            checked={selected.has(ev.id)}
                            onChange={() => toggleSelect(ev.id)} />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Link to={`/calendar/events/${ev.id}`}
                          className="text-blue-700 hover:underline whitespace-nowrap">
                          {fmtDate(ev.event_date)}
                          {ev.start_time ? ` ${normaliseTime(ev.start_time)}` : ''}
                        </Link>
                        {ev.is_private && <span className="ml-2 text-xs text-slate-400">(private)</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {normaliseTime(ev.end_time)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{ev.venue_name ?? ''}</td>
                      <td className="px-3 py-2 text-slate-700">{ev.topic ?? ''}</td>
                      <td className="px-3 py-2 text-slate-600">{ev.contact ?? ''}</td>
                    </tr>
                    {showDetail && ev.details && (
                      <tr key={`${ev.id}-detail`} className={rowBg}>
                        {canManage && <td></td>}
                        <td colSpan={dataColSpan} className="px-3 pb-2 pt-0 text-xs text-slate-500 italic">
                          {ev.details}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new event form */}
      {canManage && (
        <div className="bg-white/90 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Events</h3>
          {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}

          <form onSubmit={handleAdd} noValidate className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label htmlFor="event-add-date" className={labelCls}>First date <RequiredMark /></label>
                <input id="event-add-date" name="eventDate" type="date" className={inputCls} required value={addForm.eventDate}
                  onChange={(e) => setAdd('eventDate', e.target.value)} />
              </div>
              <div>
                <label htmlFor="event-add-start-time" className={labelCls}>Start time</label>
                <input id="event-add-start-time" name="startTime" type="time" step="900" className={inputCls} value={addForm.startTime}
                  onChange={(e) => setAdd('startTime', e.target.value)} />
              </div>
              <div>
                <label htmlFor="event-add-end-time" className={labelCls}>Until</label>
                <input id="event-add-end-time" name="endTime" type="time" step="900" className={inputCls} value={addForm.endTime}
                  onChange={(e) => setAdd('endTime', e.target.value)} />
              </div>
              <div>
                <label htmlFor="event-add-venue" className={labelCls}>Venue</label>
                <select id="event-add-venue" name="venueId" className={inputCls} value={addForm.venueId}
                  onChange={(e) => setAdd('venueId', e.target.value)}>
                  <option value="">— none —</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-40 flex-1">
                <label htmlFor="event-add-topic" className={labelCls}>Topic</label>
                <input id="event-add-topic" name="topic" className={`${inputCls} w-full`} value={addForm.topic}
                  onChange={(e) => setAdd('topic', e.target.value)} />
              </div>
              <div>
                <label htmlFor="event-add-contact" className={labelCls}>Enquiries</label>
                <input id="event-add-contact" name="contact" className={inputCls} value={addForm.contact}
                  onChange={(e) => setAdd('contact', e.target.value)} />
              </div>
              <div className="flex-1 min-w-48">
                <label htmlFor="event-add-details" className={labelCls}>Details</label>
                <input id="event-add-details" name="details" className={`${inputCls} w-full`} value={addForm.details}
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
                <label htmlFor="event-add-repeat-count" className={labelCls}>Count</label>
                <input id="event-add-repeat-count" name="repeatEvery" type="number" min="1" className={`${inputCls} w-20`} value={addForm.repeatEvery}
                  placeholder="—"
                  onChange={(e) => setAdd('repeatEvery', e.target.value)} />
              </div>
              <div>
                <label htmlFor="event-add-repeat-unit" className={labelCls}>Unit</label>
                <select id="event-add-repeat-unit" name="repeatUnit" className={inputCls} value={addForm.repeatUnit}
                  onChange={(e) => setAdd('repeatUnit', e.target.value)}>
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
              <div>
                <label htmlFor="event-add-repeat-until" className={labelCls}>Until</label>
                <input id="event-add-repeat-until" name="repeatUntil" type="date" className={inputCls} value={addForm.repeatUntil}
                  onChange={(e) => setAdd('repeatUntil', e.target.value)} />
              </div>
            </div>

            <div className="pt-1">
              <button type="submit" disabled={addSaving || !addForm.eventDate}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                {addSaving ? 'Adding…' : 'Add Events'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
