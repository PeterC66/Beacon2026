// beacon2/frontend/src/pages/roles/RoleList.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roles as rolesApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NavBar from '../../components/NavBar.jsx';

export default function RoleList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [roleList, setRoleList]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [deleting, setDeleting]   = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setRoleList(await rolesApi.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  if (loading) return <PageShell navLinks={navLinks}><Spinner /></PageShell>;
  if (error)   return <PageShell navLinks={navLinks}><ErrorMsg msg={error} /></PageShell>;

  return (
    <PageShell navLinks={navLinks}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Roles</h1>
      </div>

      {roleList.length === 0 ? (
        <p className="text-slate-500 text-sm">No roles found.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Committee role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Users</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {roleList.map((role) => (
                <tr key={role.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{role.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {role.is_committee ? (
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">Yes</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{role.user_count}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {can('role_record', 'view') && (
                      <button
                        onClick={() => navigate(`/roles/${role.id}`)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Edit
                      </button>
                    )}
                    {can('role_record', 'delete') && (
                      <button
                        onClick={() => handleDelete(role)}
                        disabled={deleting === role.id}
                        className="text-red-500 hover:underline text-xs disabled:opacity-50"
                      >
                        {deleting === role.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ navLinks, children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar links={navLinks} />
      <div className="p-6 max-w-4xl mx-auto">{children}</div>
      <NavBar links={navLinks} />
    </div>
  );
}
function Spinner() {
  return <div className="text-slate-400 text-sm">Loading…</div>;
}
function ErrorMsg({ msg }) {
  return <div className="text-red-600 text-sm">Error: {msg}</div>;
}
