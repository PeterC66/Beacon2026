// beacon2/frontend/src/pages/misc/OfficerList.jsx
// u3a Officers (offices and post holders) — doc 9.3

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { offices as officesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';

const BLANK = { name: '', memberId: '', officeEmail: '', notifyOnlineJoin: false };

// Statuses that show the post-holder in red with strikethrough
const STRUCK_STATUSES   = ['Deceased', 'Resigned'];
// Statuses that show in red only
const RED_STATUSES      = ['Lapsed'];

function holderStyle(status) {
  if (!status) return {};
  const s = status.trim();
  if (STRUCK_STATUSES.some((x) => s.toLowerCase().includes(x.toLowerCase()))) {
    return { color: '#cc0000', textDecoration: 'line-through' };
  }
  if (RED_STATUSES.some((x) => s.toLowerCase().includes(x.toLowerCase()))) {
    return { color: '#cc0000' };
  }
  return {};
}

export default function OfficerList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [list,     setList]     = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const tableRef = useRef(null);

  const [editId,   setEditId]   = useState(null);   // null | 'new' | office id
  const [form,     setForm]     = useState(BLANK);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState({});
  const [selected, setSelected] = useState(new Set()); // Set of office ids

  const navLinks = [{ label: 'Home', to: '/' }];

  // Only non-vacant offices can be selected for email
  const selectable = list.filter((o) => o.member_id);

  function toggleAll() {
    if (selected.size === selectable.length && selectable.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((o) => o.id)));
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sendEmail() {
    const memberIds = list
      .filter((o) => selected.has(o.id) && o.member_id)
      .map((o) => o.member_id);
    sessionStorage.setItem('emailComposeMemberIds', JSON.stringify(memberIds));
    navigate('/email/compose');
  }

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [offices, mems] = await Promise.all([officesApi.list(), officesApi.listMembers()]);
      setList(offices);
      setMembers(mems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startAdd() {
    setEditId('new');
    setForm(BLANK);
    setFormErr({});
  }

  function startEdit(office) {
    setEditId(office.id);
    setForm({
      name:             office.name,
      memberId:         office.member_id ?? '',
      officeEmail:      office.office_email ?? '',
      notifyOnlineJoin: office.notify_online_join,
    });
    setFormErr({});
  }

  function cancelEdit() { setEditId(null); setFormErr({}); }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Office name is required.';
    if (form.officeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officeEmail)) {
      errs.officeEmail = 'Enter a valid email address.';
    }
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErr(errs); return; }
    setSaving(true);
    setFormErr({});
    try {
      const payload = {
        name:             form.name.trim(),
        memberId:         form.memberId || null,
        officeEmail:      form.officeEmail.trim() || null,
        notifyOnlineJoin: form.notifyOnlineJoin,
      };
      if (editId === 'new') {
        await officesApi.create(payload);
      } else {
        await officesApi.update(editId, payload);
      }
      setEditId(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(office) {
    if (!confirm(`Delete office "${office.name}"?`)) return;
    try {
      await officesApi.delete(office.id);
      setList((prev) => prev.filter((o) => o.id !== office.id));
      if (editId === office.id) setEditId(null);
    } catch (err) { setError(err.message); }
  }

  const inputCls = 'w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const errCls   = 'w-full border border-red-400 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400';

  function renderEditRow(key) { return (
    <tr key={key} className="bg-blue-50 border-b border-slate-200">
      <td className="px-3 py-2 text-center"></td>
      <td className="px-3 py-2">
        <input type="text" value={form.name} autoFocus
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Office name" maxLength={100}
          className={formErr.name ? errCls : inputCls} />
        {formErr.name && <p className="text-xs text-red-600 mt-0.5">{formErr.name}</p>}
      </td>
      <td className="px-3 py-2">
        <select value={form.memberId}
          onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
          className={inputCls}>
          <option value="">— none —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.surname}, {m.forenames}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input type="email" value={form.officeEmail}
          onChange={(e) => setForm((f) => ({ ...f, officeEmail: e.target.value }))}
          placeholder="office@example.com" maxLength={200}
          className={formErr.officeEmail ? errCls : inputCls} />
        {formErr.officeEmail && <p className="text-xs text-red-600 mt-0.5">{formErr.officeEmail}</p>}
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={form.notifyOnlineJoin}
          onChange={(e) => setForm((f) => ({ ...f, notifyOnlineJoin: e.target.checked }))}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-3 py-1 text-sm font-medium mr-2">
          {saving ? 'Saving…' : 'Save Record'}
        </button>
        <button onClick={cancelEdit}
          className="border border-slate-300 rounded px-3 py-1 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </td>
    </tr>
  ); }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-5xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">u3a Offices and Post Holders</h1>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm text-center mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : (
          <>
            {can('offices', 'create') && editId === null && (
              <div className="mb-3">
                <button onClick={startAdd}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-medium transition-colors">
                  Add new office
                </button>
              </div>
            )}

            {/* Bulk action bar */}
            {can('email', 'send') && selected.size > 0 && (
              <div className="flex items-center gap-3 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm text-slate-600">{selected.size} selected</span>
                <button onClick={sendEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                  Send E-mail
                </button>
              </div>
            )}

            <div ref={tableRef} className="overflow-x-auto rounded-lg shadow-sm mb-4">
              <table className="w-full text-sm bg-white min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <th className="px-3 py-2.5 font-normal text-center">
                      {can('email', 'send') && selectable.length > 0 && (
                        <button onClick={toggleAll} className="text-blue-600 hover:underline text-xs font-normal not-italic">
                          {selected.size === selectable.length && selectable.length > 0 ? 'Clear' : 'Select'}
                        </button>
                      )}
                    </th>
                    <th className="px-3 py-2.5 font-normal">Office</th>
                    <th className="px-3 py-2.5 font-normal">Post Holder</th>
                    <th className="px-3 py-2.5 font-normal">Office Email</th>
                    <th className="px-3 py-2.5 font-normal text-center">Notifications</th>
                    <th className="px-3 py-2.5 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {editId === 'new' && renderEditRow('new')}
                  {list.map((office, i) => (
                    editId === office.id ? (
                      renderEditRow(office.id)
                    ) : (
                      <tr key={office.id}
                        className={`border-b border-slate-100 ${selected.has(office.id) ? 'outline outline-2 outline-blue-400' : i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                        <td className="px-3 py-2 text-center">
                          {office.member_id && can('email', 'send') && (
                            <input type="checkbox" checked={selected.has(office.id)}
                              onChange={() => toggleOne(office.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium">{office.name}</td>
                        <td className="px-3 py-2">
                          {office.member_forenames || office.member_surname ? (
                            <span style={holderStyle(office.member_status)}>
                              {office.member_forenames} {office.member_surname}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Vacant</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{office.office_email ?? ''}</td>
                        <td className="px-3 py-2 text-center">{office.notify_online_join ? '✓' : ''}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap space-x-3">
                          {can('offices', 'change') && (
                            <button onClick={() => startEdit(office)}
                              className="text-blue-700 hover:underline text-xs">edit</button>
                          )}
                          {can('offices', 'delete') && (
                            <button onClick={() => handleDelete(office)}
                              className="text-red-600 hover:underline text-xs">delete</button>
                          )}
                        </td>
                      </tr>
                    )
                  ))}
                  {list.length === 0 && editId !== 'new' && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-400 italic">No offices yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ScrollButtons containerRef={tableRef} />

      <NavBar links={navLinks} />
    </div>
  );
}
