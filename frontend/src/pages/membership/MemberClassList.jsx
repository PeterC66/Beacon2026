// beacon2/frontend/src/pages/membership/MemberClassList.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { memberClasses as api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

export default function MemberClassList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [classList, setClassList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [deleting,  setDeleting]  = useState(null);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(classList);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setClassList(await api.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(mc) {
    if (!confirm(`Delete membership class "${mc.name}"? This cannot be undone.`)) return;
    setDeleting(mc.id);
    try {
      await api.delete(mc.id);
      setClassList((prev) => prev.filter((c) => c.id !== mc.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('member_classes', 'create') ? [{ label: 'Add Membership Class', to: '/membership/classes/new' }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">Membership Classes</h1>

        {loading && <p className="text-center text-slate-500">Loading…</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {!loading && !error && (
          classList.length === 0 ? (
            <p className="text-center text-slate-500">No membership classes found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table className="w-full text-sm bg-white min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <SortableHeader col="name"         label="Name"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
                    <SortableHeader col="current"      label="Current"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal text-center" />
                    <SortableHeader col="is_joint"     label="Joint"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal text-center" />
                    <SortableHeader col="is_associate" label="Associate" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal text-center" />
                    <SortableHeader col="fee"          label="Fee (£)"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal text-right" />
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((mc, i) => (
                    <tr key={mc.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      <td className="px-4 py-2.5">{mc.name}{mc.locked && <span className="ml-2 text-xs text-slate-400 italic">locked</span>}</td>
                      <td className="px-4 py-2.5 text-center">{mc.current    ? 'Y' : ''}</td>
                      <td className="px-4 py-2.5 text-center">{mc.is_joint   ? 'Y' : ''}</td>
                      <td className="px-4 py-2.5 text-center">{mc.is_associate ? 'Y' : ''}</td>
                      <td className="px-4 py-2.5 text-right">{mc.fee != null ? Number(mc.fee).toFixed(2) : '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {can('member_classes', 'change') && (
                          <a
                            href="#edit"
                            onClick={(e) => { e.preventDefault(); navigate(`/membership/classes/${mc.id}`); }}
                            className="text-blue-700 hover:underline mr-4"
                          >
                            Edit
                          </a>
                        )}
                        {can('member_classes', 'delete') && !mc.locked && (
                          <a
                            href="#del"
                            onClick={(e) => { e.preventDefault(); handleDelete(mc); }}
                            className="text-red-600 hover:underline"
                          >
                            {deleting === mc.id ? 'Deleting…' : 'Delete'}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
