// beacon2/frontend/src/pages/groups/VenueList.jsx
// List of group venues (5.7)

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { venues as venuesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

export default function VenueList() {
  const { can, tenant } = useAuth();
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(list, 'name');

  const canCreate = can('group_venues', 'create');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await venuesApi.list();
      setList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const navLinks = [
    { label: 'Home',   to: '/' },
    { label: 'Groups', to: '/groups' },
    ...(canCreate ? [{ label: 'Add new venue', to: '/venues/new' }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-center mb-4">Group Venues</h1>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500 py-8">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="bg-white/90 rounded-lg shadow-sm p-6 text-center text-slate-500 text-sm">
            No venues yet.{canCreate && <> <Link to="/venues/new" className="text-blue-700 hover:underline">Add a venue</Link>.</>}
          </div>
        ) : (
          <div className="bg-white/90 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                  <SortableHeader col="name"     label="Venue"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
                  <SortableHeader col="town"     label="Town"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
                  <SortableHeader col="postcode" label="Postcode" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
                  <th className="px-4 py-2.5 font-normal">Flags</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((v, i) => (
                  <tr key={v.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                    <td className="px-4 py-2">
                      <Link to={`/venues/${v.id}`} className="text-blue-700 hover:underline">{v.name}</Link>
                    </td>
                    <td className="px-4 py-2">{v.town ?? ''}</td>
                    <td className="px-4 py-2">{v.postcode ?? ''}</td>
                    <td className="px-4 py-2 text-xs text-slate-500 space-x-2">
                      {v.private_address && <span title="Private address">Private</span>}
                      {v.accessible      && <span title="Wheelchair accessible">♿</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
