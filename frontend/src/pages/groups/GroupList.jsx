// beacon2/frontend/src/pages/groups/GroupList.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { groups as groupsApi, faculties as facultiesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GroupList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();

  const [groupList,   setGroupList]   = useState([]);
  const { sorted, sortKey, sortDir, onSort } = useSortedData(groupList);
  const [faculties,   setFaculties]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const tableRef = useRef(null);

  const [activeOnly,   setActiveOnly]  = useState(true);
  const [facultyId,    setFacultyId]   = useState('');
  const [letter,       setLetter]      = useState('');

  useEffect(() => {
    facultiesApi.list().then(setFaculties).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [activeOnly, facultyId, letter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.list({ activeOnly, facultyId, letter });
      setGroupList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLetterClick(l) {
    setLetter(l === letter ? '' : l);
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('group_records_all', 'create') ? [{ label: 'Add New Group', to: '/groups/new' }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-3">Groups</h1>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="bg-white/90 rounded-lg shadow-sm p-3 mb-3 flex flex-wrap gap-4 items-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show active only
          </label>

          {faculties.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Faculty</label>
              <select
                name="facultyId"
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All faculties</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
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
          groupList.length === 0 ? (
            <p className="text-center text-slate-500 py-6">No groups found.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-1">{groupList.length} group{groupList.length !== 1 ? 's' : ''}</p>
              <div className="overflow-x-auto rounded-lg shadow-sm" ref={tableRef}>
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <SortableHeader col="name"         label="Group"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <SortableHeader col="when_text"    label="When"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      <th className="px-3 py-2 font-normal">Leader(s)</th>
                      <SortableHeader col="member_count" label="Members" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />
                      {!activeOnly && <SortableHeader col="status"       label="Status"  sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />}
                      {faculties.length > 0 && <SortableHeader col="faculty_name" label="Faculty" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-3 py-2 font-normal" />}
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((g, i) => (
                      <tr
                        key={g.id}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {can('group_records_all', 'view') ? (
                            <button
                              onClick={() => navigate(`/groups/${g.id}`)}
                              className="text-blue-700 hover:underline text-left"
                            >
                              {g.name}
                            </button>
                          ) : g.name}
                          {g.status === 'inactive' && (
                            <span className="ml-2 text-xs text-red-500">(inactive)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{g.when_text ?? ''}</td>
                        <td className="px-3 py-2">
                          {(g.leaders ?? []).map((l) => `${l.forenames} ${l.surname}`).join(', ')}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{g.member_count ?? 0}</td>
                        {!activeOnly && (
                          <td className="px-3 py-2">
                            <span className={g.status === 'active' ? 'text-green-700' : 'text-red-600'}>
                              {g.status}
                            </span>
                          </td>
                        )}
                        {faculties.length > 0 && (
                          <td className="px-3 py-2 text-slate-500">{g.faculty_name ?? ''}</td>
                        )}
                        <td className="px-3 py-2 text-right">
                          {can('group_records_all', 'view') && (
                            <button
                              onClick={() => navigate(`/groups/${g.id}`)}
                              className="text-blue-700 hover:underline text-xs"
                            >
                              Edit
                            </button>
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
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
