// beacon2/frontend/src/pages/members/MemberList.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { members as membersApi, memberStatuses as statusApi, memberClasses as classApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function MemberList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [memberList,  setMemberList]  = useState([]);
  const [statuses,    setStatuses]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);   // status IDs
  const [selectedClass,    setSelectedClass]    = useState('');
  const [letter,           setLetter]           = useState('');
  const [searchInput,      setSearchInput]      = useState('');
  const [activeSearch,     setActiveSearch]     = useState('');

  // Row refs for letter-jump
  const rowRefs = useRef({});

  // Load statuses + classes once
  useEffect(() => {
    Promise.all([statusApi.list(), classApi.list()])
      .then(([s, c]) => {
        setStatuses(s);
        setClasses(c);
        // Default: show "Current" status only
        const current = s.find((x) => x.name === 'Current');
        if (current) setSelectedStatuses([current.id]);
      })
      .catch(() => {});
  }, []);

  // Load members whenever filters change
  useEffect(() => { load(); }, [selectedStatuses, selectedClass, letter, activeSearch]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await membersApi.list({
        status:  selectedStatuses.join(','),
        classId: selectedClass,
        letter,
        q:       activeSearch,
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

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('member_record', 'create') ? [{ label: 'Add New Member', to: '/members/new' }] : []),
  ];

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

          {/* Class + search row */}
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
              <p className="text-sm text-slate-500 mb-1">{memberList.length} member{memberList.length !== 1 ? 's' : ''}</p>
              <div className="overflow-x-auto rounded-lg shadow-sm">
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className="px-3 py-2 font-normal">No</th>
                      <th className="px-3 py-2 font-normal">Surname</th>
                      <th className="px-3 py-2 font-normal">Forenames</th>
                      <th className="px-3 py-2 font-normal">Known as</th>
                      <th className="px-3 py-2 font-normal">Town</th>
                      <th className="px-3 py-2 font-normal">Postcode</th>
                      <th className="px-3 py-2 font-normal">Email</th>
                      <th className="px-3 py-2 font-normal">Status</th>
                      <th className="px-3 py-2 font-normal">Class</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberList.map((m, i) => (
                      <tr
                        key={m.id}
                        ref={(el) => { if (el) rowRefs.current[m.surname?.[0]?.toUpperCase()] = el; }}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                      >
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
            </>
          )
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
