// beacon2/frontend/src/pages/users/UserList.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { users as usersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

export default function UserList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [userList, setUserList] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(userList);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setUserList(await usersApi.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await usersApi.delete(user.id);
      setUserList((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const TH = 'px-4 py-2.5 font-normal';
  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('user_record', 'create') ? [{ label: 'Add User', to: '/users/new' }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">

      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">System Users</h1>

        {loading && <p className="text-center text-slate-500">Loading…</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {!loading && !error && (
          userList.length === 0 ? (
            <p className="text-center text-slate-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table className="w-full text-sm bg-white min-w-max">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                    <SortableHeader col="name"     label="Name"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <SortableHeader col="username" label="Username" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                    <SortableHeader col="active"   label="Active"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={`${TH} text-center`} />
                    <th className={TH}>Roles</th>
                    {(can('user_record', 'view') || can('user_record', 'delete')) && <th className="px-4 py-2.5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((user, i) => (
                    <tr key={user.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                      <td className="px-4 py-2.5 font-medium">
                        {can('user_record', 'view') ? (
                          <button
                            onClick={() => navigate(`/users/${user.id}`)}
                            className="text-blue-700 hover:underline text-left"
                          >
                            {user.name}
                          </button>
                        ) : user.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{user.username ?? ''}</td>
                      <td className="px-4 py-2.5 text-center">{user.active ? 'Y' : ''}</td>
                      <td className="px-4 py-2.5">{user.roles.map((r) => r.name).join(', ')}</td>
                      {(can('user_record', 'view') || can('user_record', 'delete')) && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {can('user_record', 'view') && (
                            <a
                              href="#edit"
                              onClick={(e) => { e.preventDefault(); navigate(`/users/${user.id}`); }}
                              className="text-blue-700 hover:underline mr-4"
                            >
                              Edit
                            </a>
                          )}
                          {can('user_record', 'delete') && (
                            <a
                              href="#del"
                              onClick={(e) => { e.preventDefault(); handleDelete(user); }}
                              className="text-red-600 hover:underline"
                            >
                              {deleting === user.id ? 'Deleting…' : 'Delete'}
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
    </div>
  );
}
