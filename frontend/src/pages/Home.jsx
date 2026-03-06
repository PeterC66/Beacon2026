// beacon2/frontend/src/pages/Home.jsx
// Landing page after login. Shows the u3a name, welcome message,
// and cards linking to available modules.

import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user, tenant, logout, can } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-slate-800">
            Beacon<span className="text-blue-600">2</span>
          </span>
          {tenant && (
            <span className="ml-3 text-slate-500 text-sm capitalize">{tenant}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {user?.name && (
            <span className="text-slate-600">Signed in as <strong>{user.name}</strong></span>
          )}
          <button onClick={handleLogout} className="text-red-600 hover:underline">
            Sign out
          </button>
        </div>
      </header>

      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-800 mb-1">Home</h1>
        <p className="text-slate-500 text-sm mb-8">Select a section to manage.</p>

        <div className="grid gap-4 sm:grid-cols-2">

          {can('role_record', 'view') && (
            <ModuleCard
              title="Roles & Privileges"
              description="Manage user roles and their permission sets."
              links={[
                { label: 'Roles list', to: '/roles' },
                { label: 'Add role', to: '/roles/new' },
              ]}
            />
          )}

        </div>
      </div>
    </div>
  );
}

function ModuleCard({ title, description, links }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <h2 className="font-semibold text-slate-800 mb-1">{title}</h2>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      <div className="flex flex-wrap gap-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-sm text-blue-600 hover:underline"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
