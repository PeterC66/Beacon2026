// beacon2/frontend/src/pages/admin/Utilities.jsx
// Utilities menu — lists administrative utility tools.

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import NavBar from '../../components/NavBar.jsx';

const UTILITIES = [
  {
    label: 'Validate member data',
    tip: 'Check member records for missing or inconsistent data',
    to: '/admin/validate-members',
    privilege: { resource: 'member_data_validation', action: 'view' },
  },
];

export default function Utilities() {
  const { can, tenant } = useAuth();

  const navLinks = [{ label: 'Home', to: '/' }, { label: 'Utilities' }];

  return (
    <div className="min-h-screen pb-10">
      <PageHeader tenant={tenant} />
      <NavBar links={navLinks} />

      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Utilities</h1>

        <div className="bg-white/90 rounded-lg shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {UTILITIES.map((item) => {
              const allowed = can(item.privilege.resource, item.privilege.action);
              return (
                <li key={item.label} className="px-4 py-3 text-sm">
                  {allowed
                    ? <Link to={item.to} title={item.tip} className="text-blue-700 hover:underline">{item.label}</Link>
                    : <span title={item.tip} className="text-slate-400">{item.label}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <NavBar links={navLinks} />
    </div>
  );
}
