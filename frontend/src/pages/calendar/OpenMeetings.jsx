// beacon2/frontend/src/pages/calendar/OpenMeetings.jsx
// Open Meetings & Events — events not tied to a specific group.
// Follows the same UI pattern as GroupSchedule in GroupRecord.jsx.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { calendar as calendarApi, venues as venuesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import RequiredMark from '../../components/RequiredMark.jsx';
import PageHeader from '../../components/PageHeader.jsx';

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function normaliseTime(t) {
  if (!t) return '';
  const s = String(t);
  const tIdx = s.indexOf('T');
  if (tIdx !== -1) return s.slice(tIdx + 1, tIdx + 6);
  return s.slice(0, 5);
}

export default function OpenMeetings() {
  const { can, tenant } = useAuth();

  const [events,    setEvents]    = useState([]);
  const [venues,    setVenues]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());

  // Add form
  const EMPTY_EV = {
    eventDate: '', startTime: '', endTime: '', venueId: '',
    topic: '', contact: '', details: '', isPrivate: false,
    repeatEvery: '', repeatUnit: 'weeks', repeatUntil: '',
  };
  const [addForm,   setAddForm]   = useState(EMPTY_EV);
  const [addError,  setAddError]  = useState(null);
  const [addSaving, setAddSaving] = useState(false);

  // Inline edit
  const [editId,     setEditId]     = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [editError,  setEditError]  = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const canManage = can('meetings', 'create') || can('meetings', 'change');

  useEffect(() => {
    load();
    venuesApi.list().then(setVenues).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await calendarApi.listOpenEvents();
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
        eventDate:  addForm.eventDate,
        startTime:  addForm.startTime || null,
        endTime:    addForm.endTime || null,
        venueId:    addForm.venueId || null,
        topic:      addForm.topic || null,
        contact:    addForm.contact || null,
        details:    addForm.details || null,
        isPrivate:  addForm.isPrivate,
      };
      if (addForm.repeatEvery && addForm.repeatUntil) {
        payload.repeatEvery = parseInt(addForm.repeatEvery, 10);
        payload.repeatUnit  = addForm.repeatUnit;
        payload.repeatUntil = addForm.repeatUntil;
      }
      await calendarApi.createOpenEvents(payload);
      setAddForm(EMPTY_EV);
      await load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
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
      const updated = await calendarApi.updateOpenEvent(evId, payload);
      setEvents((prev) => prev.map((e) => e.id === evId ? { ...e, ...updated } : e));
      cancelEdit();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(events.map((e) => e.id))); }
  function deselectAll() { setSelected(new Set()); }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} event(s)?`)) return;
    try {
      await calendarApi.deleteOpenEvents([...selected]);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const inputCls = 'border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const cbCls    = 'rounded border-slate-300 text-blue-600 focus:ring-blue-500';
  const dataColSpan = 5;

  const navLinks = [
    { label: 'Home',     to: '/' },
    { label: 'Calendar', to: '/calendar' },
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 mt-4 space-y-4">
        <h1 className="text-xl font-bold text-center">Open Meetings &amp; Events</h1>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading...</p>
        ) : (
          <>
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
              <p className="text-slate-500 text-sm">No open meetings scheduled.</p>
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
                    {events.map((ev, i) => {
                      const rowBg = i % 2 === 0 ? 'bg-yellow-50' : 'bg-white';
                      const totalColSpan = (canManage ? 2 : 0) + dataColSpan;

                      if (editId === ev.id) {
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
                                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                                  className="border border-slate-300 rounded px-3 py-1 text-xs hover:bg-slate-50">
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

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
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                              {normaliseTime(ev.end_time)}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{ev.venue_name ?? ''}</td>
                            <td className="px-3 py-2 text-slate-700">{ev.topic ?? ''}</td>
                            <td className="px-3 py-2 text-slate-600">{ev.contact ?? ''}</td>
                            {canManage && <td className="px-3 py-2"></td>}
                          </tr>
                          {showDetail && ev.details && (
                            <tr key={`${ev.id}-detail`} className={rowBg}>
                              {canManage && <td></td>}
                              <td colSpan={dataColSpan} className="px-3 pb-2 pt-0 text-xs text-slate-500 italic">
                                {ev.details}
                              </td>
                              {canManage && <td></td>}
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
                        {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
