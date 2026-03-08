// beacon2/frontend/src/pages/users/UserList.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { users as usersApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import BeaconLogo from '../../components/BeaconLogo.jsx';

export default function UserList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [userList, setUserList] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);

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

  const navLinks = [
    { label: 'Home', to: '/' },
    ...(can('user_record', 'create') ? [{ label: 'Add User', to: '/users/new' }] : []),
  ];

  const tenantDisplay = tenant
    ? tenant.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 40 }}>

      {/* Logo + tenant header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 32px 8px' }}>
        <BeaconLogo />
        {tenantDisplay && (
          <span style={{ fontFamily: 'Arial', fontSize: 42, marginLeft: 24, color: '#000' }}>
            {tenantDisplay}
          </span>
        )}
      </div>

      <NavBar links={navLinks} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 16px' }}>
        <h1 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 14 }}>System Users</h1>

        {loading && <p style={{ textAlign: 'center', color: '#555' }}>Loading…</p>}
        {error   && <p style={{ textAlign: 'center', color: 'red' }}>Error: {error}</p>}

        {!loading && !error && (
          userList.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#555' }}>No users found.</p>
          ) : (
            <table className="b-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Active</th>
                  <th>Roles</th>
                  {(can('user_record', 'view') || can('user_record', 'delete')) && <th></th>}
                </tr>
              </thead>
              <tbody>
                {userList.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td style={{ textAlign: 'center' }}>{user.active ? 'Y' : ''}</td>
                    <td>{user.roles.map((r) => r.name).join(', ')}</td>
                    {(can('user_record', 'view') || can('user_record', 'delete')) && (
                      <td className="b-td-action" style={{ textAlign: 'right' }}>
                        {can('user_record', 'view') && (
                          <a
                            href="#edit"
                            onClick={(e) => { e.preventDefault(); navigate(`/users/${user.id}`); }}
                            style={{ marginRight: 8 }}
                          >
                            Edit
                          </a>
                        )}
                        {can('user_record', 'delete') && (
                          <a
                            href="#del"
                            onClick={(e) => { e.preventDefault(); handleDelete(user); }}
                            style={{ color: '#cc0000' }}
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
          )
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
