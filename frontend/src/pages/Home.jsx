// beacon2/frontend/src/pages/Home.jsx
// Landing page after login — styled to match Beacon's main menu page.

import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BeaconLogo from '../components/BeaconLogo.jsx';

export default function Home() {
  const { user, tenant, logout, can } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Tenant display name: capitalise the slug for now
  const tenantDisplay = tenant
    ? tenant.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 40 }}>

      {/* ── Logo + tenant name header ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 32px 8px' }}>
        <BeaconLogo />
        {tenantDisplay && (
          <span style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: 42,
            fontWeight: 'normal',
            marginLeft: 24,
            color: '#000',
          }}>
            {tenantDisplay}
          </span>
        )}
      </div>

      {/* ── Page title + user info ────────────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 6px' }}>Administration</h1>
        <span style={{ fontSize: 13, color: '#222' }}>
          You are logged in as {user?.name ?? user?.email ?? ''}
          {'  '}
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#0000ff', cursor: 'pointer', fontSize: 13, padding: 0 }}
          >
            Log Out
          </button>
        </span>
      </div>

      {/* ── Main menu table ───────────────────────────────────── */}
      <table className="b-menu-table">
        <thead>
          <tr>
            <th>Membership</th>
            <th>Groups</th>
            <th>Finance</th>
            <th>Misc</th>
            <th>Set up</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span className="b-menu-link-dim">Members</span></td>
            <td><span className="b-menu-link-dim">Groups</span></td>
            <td><span className="b-menu-link-dim">Ledger (by account)</span></td>
            <td><span className="b-menu-link-dim">Audit log</span></td>
            <td>
              {can('users_list', 'view')
                ? <Link to="/users">System users</Link>
                : <span className="b-menu-link-dim">System users</span>}
            </td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Add new member</span></td>
            <td><span className="b-menu-link-dim">Venues</span></td>
            <td><span className="b-menu-link-dim">Ledger (by category)</span></td>
            <td><span className="b-menu-link-dim">Gift aid log</span></td>
            <td>
              {can('role_record', 'view')
                ? <Link to="/roles">Roles and privileges</Link>
                : <span className="b-menu-link-dim">Roles and privileges</span>}
            </td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Membership renewals</span></td>
            <td><span className="b-menu-link-dim">Faculties</span></td>
            <td><span className="b-menu-link-dim">Ledger (by group)</span></td>
            <td><span className="b-menu-link-dim">u3a Officers</span></td>
            <td><span className="b-menu-link-dim">System settings</span></td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Recent members</span></td>
            <td><span className="b-menu-link-dim">Calendar</span></td>
            <td><span className="b-menu-link-dim">Add transaction</span></td>
            <td><span className="b-menu-link-dim">Public links</span></td>
            <td><span className="b-menu-link-dim">System messages</span></td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Non-renewals</span></td>
            <td></td>
            <td><span className="b-menu-link-dim">Transfer money</span></td>
            <td><span className="b-menu-link-dim">Data export &amp; backup</span></td>
            <td><span className="b-menu-link-dim">Finance accounts</span></td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Membership cards</span></td>
            <td></td>
            <td><span className="b-menu-link-dim">Credit batches</span></td>
            <td><span className="b-menu-link-dim">E-mail delivery</span></td>
            <td><span className="b-menu-link-dim">Finance categories</span></td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Addresses export</span></td>
            <td></td>
            <td><span className="b-menu-link-dim">Reconcile account</span></td>
            <td><span className="b-menu-link-dim">Personal preferences</span></td>
            <td><span className="b-menu-link-dim">Membership classes</span></td>
          </tr>
          <tr>
            <td><span className="b-menu-link-dim">Statistics</span></td>
            <td></td>
            <td><span className="b-menu-link-dim">Financial statement</span></td>
            <td></td>
            <td><span className="b-menu-link-dim">Member statuses</span></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td><span className="b-menu-link-dim">Gift Aid declaration</span></td>
            <td></td>
            <td><span className="b-menu-link-dim">Poll</span></td>
          </tr>
          <tr>
            <td className="b-menu-footer" colSpan={5} style={{ textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: '#555' }}>
              Hover mouse over captions for more information
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  );
}
