// beacon2/frontend/src/pages/roles/RoleList.jsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { roles as rolesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

export default function RoleList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [roleList, setRoleList] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);
  const tableRef = useRef(null);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(roleList);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setRoleList(await rolesApi.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(role) {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setDeleting(role.id);
    try {
      await rolesApi.delete(role.id);
      setRoleList((prev) => prev.filter((r) => r.id !== role.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('role_record', 'create') ? [{ label: 'Add Role', to: '/roles/new' }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">

      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-3xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">User Roles</h1>

        {loading && <p className="text-center text-slate-500">Loading…</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {!loading && !error && (
          roleList.length === 0 ? (
            <p className="text-center text-slate-500">No roles found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-sm" ref={tableRef}>
              <table className="w-full text-sm bg-white min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <SortableHeader col="name"         label="Role Name"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
                    <SortableHeader col="is_committee" label="Committee role" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal text-center" />
                    <SortableHeader col="user_count"   label="Users"          sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal text-center" />
                    {(can('role_record', 'view') || can('role_record', 'delete')) && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((role, i) => (
                    <tr key={role.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      <td className="px-4 py-2.5">{role.name}</td>
                      <td className="px-4 py-2.5 text-center">{role.is_committee ? 'Y' : ''}</td>
                      <td className="px-4 py-2.5 text-center">{role.user_count}</td>
                      {(can('role_record', 'view') || can('role_record', 'delete')) && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {can('role_record', 'view') && (
                            <a
                              href="#edit"
                              onClick={(e) => { e.preventDefault(); navigate(`/roles/${role.id}`); }}
                              className="text-blue-700 hover:underline mr-4"
                            >
                              Edit
                            </a>
                          )}
                          {can('role_record', 'delete') && (
                            <a
                              href="#del"
                              onClick={(e) => { e.preventDefault(); handleDelete(role); }}
                              className="text-red-600 hover:underline"
                            >
                              {deleting === role.id ? 'Deleting…' : 'Delete'}
                            </a>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <NavBar links={navLinks} />
      <ScrollButtons containerRef={tableRef} />
    </div>
  );
}
