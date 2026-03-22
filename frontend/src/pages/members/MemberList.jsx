// beacon2/frontend/src/pages/members/MemberList.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi, polls as pollsApi } from '../../lib/api.js';

const DOWNLOAD_FIELDS = [
  { key: 'membership_number', label: 'Membership No', default: true },
  { key: 'title',             label: 'Title',         default: false },
  { key: 'forenames',         label: 'Forenames',     default: true },
  { key: 'known_as',          label: 'Known As',      default: false },
  { key: 'surname',           label: 'Surname',       default: true },
  { key: 'email',             label: 'Email',         default: true },
  { key: 'mobile',            label: 'Mobile',        default: true },
  { key: 'telephone',         label: 'Telephone',     default: false },
  { key: 'address',           label: 'Address',       default: false },
  { key: 'town',              label: 'Town',          default: true },
  { key: 'county',            label: 'County',        default: false },
  { key: 'postcode',          label: 'Postcode',      default: true },
  { key: 'country',           label: 'Country',       default: false },
  { key: 'status',            label: 'Status',        default: true },
  { key: 'class',             label: 'Class',         default: true },
  { key: 'joined_on',         label: 'Joined',        default: false },
  { key: 'next_renewal',      label: 'Next Renewal',  default: false },
];
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function MemberList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [memberList,  setMemberList]  = useState([]);
  const { sorted, sortKey, sortDir, onSort } = useSortedData(memberList);
  const [statuses,    setStatuses]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [polls,       setPolls]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedClass,    setSelectedClass]    = useState('');
  const [selectedPoll,     setSelectedPoll]     = useState('');
  const [negatePoll,       setNegatePoll]       = useState(false);
  const [letter,           setLetter]           = useState('');
  const [searchInput,      setSearchInput]      = useState('');
  const [activeSearch,     setActiveSearch]     = useState('');

  // Selection + bulk actions
  const [selected,      setSelected]      = useState(new Set());
  const [bulkAction,    setBulkAction]    = useState('');
  const [addToPollId,   setAddToPollId]   = useState('');
  const [bulkWorking,   setBulkWorking]   = useState(false);
  const [bulkResult,    setBulkResult]    = useState(null);

  // Downloads
  const [dlFields,      setDlFields]      = useState(new Set(DOWNLOAD_FIELDS.filter((f) => f.default).map((f) => f.key)));
  const [downloading,   setDownloading]   = useState(false);
  const [dlError,       setDlError]       = useState(null);

  // Row refs for letter-jump
  const rowRefs = useRef({});

  // Load statuses, classes, polls once
  useEffect(() => {
    Promise.all([statusApi.list(), classApi.list(), pollsApi.list()])
      .then(([s, c, p]) => {
        setStatuses(s);
        setClasses(c);
        setPolls(p);
        const current = s.find((x) => x.name === 'Current');
        if (current) setSelectedStatuses([current.id]);
      })
      .catch(() => {});
  }, []);

  // Load members whenever filters change
  useEffect(() => { load(); }, [selectedStatuses, selectedClass, selectedPoll, negatePoll, letter, activeSearch]);

  async function load() {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setBulkResult(null);
    try {
      const data = await membersApi.list({
        status:     selectedStatuses.join(','),
        classId:    selectedClass,
        pollId:     selectedPoll,
        negatePoll: negatePoll && selectedPoll ? true : false,
        letter,
        q:          activeSearch,
      });
      setMemberList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleStatus(id) {
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSearch(e) {
    e.preventDefault();
    setActiveSearch(searchInput);
    setLetter('');
  }

  function handleCancelSearch() {
    setSearchInput('');
    setActiveSearch('');
  }

  function handleLetterClick(l) {
    setLetter(l === letter ? '' : l);
    setActiveSearch('');
    setSearchInput('');
  }

  // Selection helpers
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll()   { setSelected(new Set(sorted.map((m) => m.id))); }
  function clearAll()    { setSelected(new Set()); }
  function selectEmail() { setSelected(new Set(sorted.filter((m) => m.email).map((m) => m.id))); }
  function selectNoEmail() { setSelected(new Set(sorted.filter((m) => !m.email).map((m) => m.id))); }

  async function handleBulkDo() {
    if (selected.size === 0) return;
    if (bulkAction === 'send_email') {
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([...selected]));
      navigate('/email/compose');
      return;
    }
    if (bulkAction === 'send_letter') {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([...selected]));
      navigate('/letters/compose');
      return;
    }
    if (bulkAction === 'add_to_poll') {
      if (!addToPollId) return;
      setBulkWorking(true);
      setBulkResult(null);
      try {
        const result = await pollsApi.addMembers(addToPollId, [...selected]);
        const pollName = polls.find((p) => p.id === addToPollId)?.name ?? 'poll';
        setBulkResult({ type: 'success', msg: `${result.added} member${result.added !== 1 ? 's' : ''} added to "${pollName}".` });
      } catch (err) {
        setBulkResult({ type: 'error', msg: err.message });
      } finally {
        setBulkWorking(false);
      }
    }
  }

  function toggleDlField(key) {
    setDlFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDownload(format) {
    const ids = selected.size > 0 ? [...selected] : sorted.map((m) => m.id);
    const fields = format === 'email-csv' ? [] : DOWNLOAD_FIELDS.filter((f) => dlFields.has(f.key)).map((f) => f.key);
    setDownloading(true);
    setDlError(null);
    try {
      await membersApi.download(format, ids, fields);
    } catch (err) {
      setDlError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('member_record', 'create') ? [{ label: 'Add New Member', to: '/members/new' }] : []),
  ];

  const hasBulkPolls = can('poll_set_up', 'change') && polls.length > 0;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">Members</h1>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-3 space-y-3">

          {/* Status checkboxes */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium text-slate-700 mr-1">Status:</span>
            {statuses.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(s.id)}
                  onChange={() => toggleStatus(s.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {s.name}
              </label>
            ))}
          </div>

          {/* Class + Poll + search row */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {polls.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedPoll}
                    onChange={(e) => setSelectedPoll(e.target.value)}
                    className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All members</option>
                    {polls.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {selectedPoll && (
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={negatePoll}
                        onChange={(e) => setNegatePoll(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Negate poll
                    </label>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSearch} className="flex gap-2 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quick Find</label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, address, postcode, no…"
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium">
                Search
              </button>
              {activeSearch && (
                <button type="button" onClick={handleCancelSearch}
                  className="border border-slate-300 rounded px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel Search
                </button>
              )}
            </form>
          </div>
        </div>

        {/* ── Letter navigation ─────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 mb-3">
          <button
            onClick={() => handleLetterClick('')}
            className={`px-2 py-0.5 text-sm rounded border ${letter === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            All
          </button>
          {ALPHABET.map((l) => (
            <button
              key={l}
              onClick={() => handleLetterClick(l)}
              className={`px-2 py-0.5 text-sm rounded border ${letter === l ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── Results ───────────────────────────────────────────────── */}
        {error   && <p className="text-center text-red-600 mb-3">Error: {error}</p>}
        {loading && <p className="text-center text-slate-500">Loading…</p>}

        {!loading && !error && (
          memberList.length === 0 ? (
            <p className="text-center text-slate-500 py-6">No members found.</p>
          ) : (
            <>
              {/* Select controls */}
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="text-sm text-slate-500">{memberList.length} member{memberList.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-medium text-slate-600">Select:</span>
                <button onClick={selectAll}    className="text-sm text-blue-700 hover:underline">All</button>
                <button onClick={clearAll}     className="text-sm text-blue-700 hover:underline">Clear All</button>
                <button onClick={selectEmail}  className="text-sm text-blue-700 hover:underline">Email only</button>
                <button onClick={selectNoEmail} className="text-sm text-blue-700 hover:underline">Without email</button>
                {selected.size > 0 && (
                  <span className="text-sm font-medium text-blue-700 ml-2">{selected.size} selected</span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg shadow-sm mb-3">
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className="px-2 py-2"></th>
                      <SortableHeader col="membership_number" label="No"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="surname"           label="Surname"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="forenames"         label="Forenames" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="known_as"          label="Known as" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="town"              label="Town"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="postcode"          label="Postcode" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="email"             label="Email"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="status"            label="Status"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="class"             label="Class"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((m, i) => (
                      <tr
                        key={m.id}
                        ref={(el) => { if (el) rowRefs.current[m.surname?.[0]?.toUpperCase()] = el; }}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} ${selected.has(m.id) ? 'outline outline-2 outline-blue-400' : ''}`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums">{m.membership_number}</td>
                        <td className="px-3 py-2 font-medium">
                          {can('member_record', 'view') ? (
                            <a href="#view" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.id}`); }}
                              className="text-blue-700 hover:underline">
                              {m.surname}
                            </a>
                          ) : m.surname}
                        </td>
                        <td className="px-3 py-2">{m.forenames}</td>
                        <td className="px-3 py-2 text-slate-500">{m.known_as ?? ''}</td>
                        <td className="px-3 py-2">{m.town ?? ''}</td>
                        <td className="px-3 py-2">{m.postcode ?? ''}</td>
                        <td className="px-3 py-2">{m.email ?? ''}</td>
                        <td className="px-3 py-2">{m.status ?? ''}</td>
                        <td className="px-3 py-2">{m.class ?? ''}</td>
                        <td className="px-3 py-2 text-right">
                          {can('member_record', 'view') && (
                            <a href="#edit" onClick={(e) => { e.preventDefault(); navigate(`/members/${m.id}`); }}
                              className="text-blue-700 hover:underline text-xs">
                              Edit
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Bulk actions ──────────────────────────────────────── */}
              {selected.size > 0 && (
                <div className="bg-white/90 rounded-lg shadow-sm p-3 space-y-3">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Do with {selected.size} selected member{selected.size !== 1 ? 's' : ''}</label>
                      <select
                        value={bulkAction}
                        onChange={(e) => { setBulkAction(e.target.value); setBulkResult(null); setDlError(null); }}
                        className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— choose action —</option>
                        {can('email', 'send') && <option value="send_email">Send email</option>}
                        {can('letters', 'view') && <option value="send_letter">Send letter</option>}
                        {hasBulkPolls && <option value="add_to_poll">Add to poll</option>}
                        <option value="download_excel">Download Excel</option>
                        <option value="download_pdf">Download PDF</option>
                        <option value="download_emails">Download email addresses</option>
                      </select>
                    </div>

                    {bulkAction === 'add_to_poll' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Poll</label>
                        <select
                          value={addToPollId}
                          onChange={(e) => setAddToPollId(e.target.value)}
                          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— select poll —</option>
                          {polls.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}

                    {(bulkAction === 'send_email' || bulkAction === 'send_letter' || bulkAction === 'add_to_poll') && (
                      <button
                        onClick={handleBulkDo}
                        disabled={bulkWorking || (bulkAction === 'add_to_poll' && !addToPollId)}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                      >
                        {bulkWorking ? 'Working…' : 'Do with selected'}
                      </button>
                    )}

                    {bulkAction === 'download_emails' && (
                      <button onClick={() => handleDownload('email-csv')} disabled={downloading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                        {downloading ? 'Downloading…' : 'Download'}
                      </button>
                    )}

                    {bulkResult && (
                      <p className={`text-sm font-medium ${bulkResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                        {bulkResult.msg}
                      </p>
                    )}
                    {dlError && <p className="text-sm text-red-600 font-medium">{dlError}</p>}
                  </div>

                  {/* Field picker for Excel / PDF downloads */}
                  {(bulkAction === 'download_excel' || bulkAction === 'download_pdf') && (
                    <div className="border border-slate-200 rounded p-3 bg-slate-50">
                      <p className="text-sm font-medium text-slate-700 mb-2">Fields to include:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mb-3">
                        {DOWNLOAD_FIELDS.map((f) => (
                          <label key={f.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="checkbox" checked={dlFields.has(f.key)}
                              onChange={() => toggleDlField(f.key)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            {f.label}
                          </label>
                        ))}
                      </div>
                      <button onClick={() => handleDownload(bulkAction === 'download_excel' ? 'excel' : 'pdf')}
                        disabled={downloading || dlFields.size === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors">
                        {downloading ? 'Downloading…' : `Download ${bulkAction === 'download_excel' ? 'Excel' : 'PDF'}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
