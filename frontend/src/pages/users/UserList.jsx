// beacon2/frontend/src/pages/users/UserList.jsx
// System Users list — doc 8.2 / 8.2.1

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { users as usersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ScrollButtons from '../../components/ScrollButtons.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

function formatDate(iso) {
  if (!iso) return 'NEVER';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function UserList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [userList, setUserList] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const tableRef = useRef(null);

  const { sorted, sortKey, sortDir, onSort } = useSortedData(userList);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setUserList(await usersApi.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete user "${user.name}"?\nThis will only remove their ability to log in — their Member Record will remain.`)) return;
    setDeleting(user.id);
    try {
      await usersApi.delete(user.id);
      setUserList((prev) => prev.filter((u) => u.id !== user.id));
      setSelected((prev) => { const next = new Set(prev); next.delete(user.id); return next; });
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((u) => u.id)));
    }
  }

  function sendEmail() {
    // Collect member_ids from selected users (only those linked to members)
    const memberIds = sorted
      .filter((u) => selected.has(u.id) && u.member_id)
      .map((u) => u.member_id);
    if (memberIds.length === 0) {
      alert('No selected users are linked to members. Cannot send email.');
      return;
    }
    sessionStorage.setItem('emailComposeMemberIds', JSON.stringify(memberIds));
    navigate('/email/compose');
  }

  const TH = 'px-4 py-2.5 font-normal';
  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('user_record', 'create') ? [{ label: 'Add New User', to: '/users/new' }] : []),
  ];

  return (
    <div className="min-h-screen pb-10">

      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-6xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-center mb-4">System Users</h1>

        {loading && <p className="text-center text-slate-500">Loading...</p>}
        {error   && <p className="text-center text-red-600">Error: {error}</p>}

        {!loading && !error && (
          userList.length === 0 ? (
            <p className="text-center text-slate-500">No users found.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg shadow-sm" ref={tableRef}>
                <table className="w-full text-sm bg-white min-w-max">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-600 italic font-normal">
                      <th className={`${TH} text-center`}>
                        <button onClick={selectAll} className="text-blue-700 hover:underline text-xs italic font-normal">
                          Select
                        </button>
                      </th>
                      <SortableHeader col="name"           label="Full Name"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                      <SortableHeader col="username"       label="Login User Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                      <SortableHeader col="member_name"    label="Member"          sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                      <SortableHeader col="is_site_admin"  label="Site Admin"      sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={`${TH} text-center`} />
                      <SortableHeader col="created_at"     label="Date Created"    sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                      <SortableHeader col="last_login"     label="Last Accessed"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={TH} />
                      <th className={TH}>Roles</th>
                      {can('user_record', 'delete') && <th className="px-4 py-2.5"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((user, i) => (
                      <tr key={user.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'}`}>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(user.id)}
                            onChange={() => toggleSelect(user.id)}
                            className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                          />
                        </td>
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
                        <td className="px-4 py-2.5">
                          {user.member_id ? (
                            <button
                              onClick={() => navigate(`/members/${user.member_id}`)}
                              className="text-blue-700 hover:underline text-left"
                            >
                              {user.member_name}
                            </button>
                          ) : (
                            <span className="text-slate-400">{user.is_site_admin ? '' : 'Not linked'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">{user.is_site_admin ? 'YES' : ''}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(user.last_login)}</td>
                        <td className="px-4 py-2.5">{user.is_site_admin ? 'Administration' : user.roles.map((r) => r.name).join(', ')}</td>
                        {can('user_record', 'delete') && (
                          <td className="px-4 py-2.5 text-right">
                            {!user.is_site_admin && (
                              <button
                                onClick={() => handleDelete(user)}
                                className="text-red-600 hover:underline text-sm"
                              >
                                {deleting === user.id ? 'Deleting...' : 'Delete'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer: count + Send Email */}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {sorted.length} user{sorted.length !== 1 ? 's' : ''}{' '}
                  ({selected.size} selected)
                </p>
                {can('email', 'send') && selected.size > 0 && (
                  <button
                    onClick={sendEmail}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
                  >
                    Send E-mail
                  </button>
                )}
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
