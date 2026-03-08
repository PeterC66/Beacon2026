// beacon2/frontend/src/pages/roles/RoleList.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roles as rolesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';
import BeaconLogo from '../../components/BeaconLogo.jsx';

export default function RoleList() {
  const { can, tenant } = useAuth();
  const navigate = useNavigate();
  const [roleList, setRoleList] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);

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
        <h1 style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 14 }}>User Roles</h1>

        {loading && <p style={{ textAlign: 'center', color: '#555' }}>Loading…</p>}
        {error   && <p style={{ textAlign: 'center', color: 'red' }}>Error: {error}</p>}

        {!loading && !error && (
          roleList.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#555' }}>No roles found.</p>
          ) : (
            <table className="b-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Committee role</th>
                  <th>Users</th>
                  {(can('role_record', 'view') || can('role_record', 'delete')) && <th></th>}
                </tr>
              </thead>
              <tbody>
                {roleList.map((role) => (
                  <tr key={role.id}>
                    <td>{role.name}</td>
                    <td style={{ textAlign: 'center' }}>{role.is_committee ? 'Y' : ''}</td>
                    <td style={{ textAlign: 'center' }}>{role.user_count}</td>
                    {(can('role_record', 'view') || can('role_record', 'delete')) && (
                      <td className="b-td-action" style={{ textAlign: 'right' }}>
                        {can('role_record', 'view') && (
                          <a
                            href="#edit"
                            onClick={(e) => { e.preventDefault(); navigate(`/roles/${role.id}`); }}
                            style={{ marginRight: 8 }}
                          >
                            Edit
                          </a>
                        )}
                        {can('role_record', 'delete') && (
                          <a
                            href="#del"
                            onClick={(e) => { e.preventDefault(); handleDelete(role); }}
                            style={{ color: '#cc0000' }}
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
          )
        )}
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
