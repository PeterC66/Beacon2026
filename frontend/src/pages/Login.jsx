// beacon2/frontend/src/pages/Login.jsx
// Tenant user sign-in — styled to match Beacon's original login page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BeaconLogo from '../components/BeaconLogo.jsx';

export default function Login() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ tenantSlug: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(form.tenantSlug, form.email, form.password);
    if (ok) navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 }}>

      <BeaconLogo large />

      <h1 style={{ marginTop: 24, fontWeight: 'bold', textAlign: 'center', fontSize: 20 }}>
        Administration
      </h1>

      {error && <div className="b-flash-error">{error}</div>}

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ textAlign: 'right', paddingRight: 8, paddingBottom: 6, color: '#222' }}>u3a</td>
              <td style={{ paddingBottom: 6 }}>
                <input
                  name="tenantSlug"
                  value={form.tenantSlug}
                  onChange={handleChange}
                  placeholder="your-u3a-slug"
                  required
                  style={{ width: 220 }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'right', paddingRight: 8, paddingBottom: 6, color: '#222' }}>Email</td>
              <td style={{ paddingBottom: 6 }}>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  style={{ width: 220 }}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'right', paddingRight: 8, paddingBottom: 4, color: '#222' }}>Password</td>
              <td style={{ paddingBottom: 4 }}>
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    required
                    style={{ width: 196, paddingRight: 24 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    style={{
                      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0,
                    }}
                    title={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? '🙈' : '👁'}
                  </button>
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ textAlign: 'center', fontSize: 11, color: '#666', paddingBottom: 10 }}>
                Passwords are case sensitive
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ textAlign: 'center' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '3px 20px', fontSize: 13 }}
                >
                  {loading ? 'Signing in…' : 'Enter'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <hr style={{ width: 600, marginTop: 28, borderTop: '1px solid #999', border: 'none', borderBottom: '1px solid #ccc' }} />

      <p style={{ marginTop: 16, fontSize: 13 }}>
        Forgotten your username or password?{' '}
        <a href="#forgot">Click here.</a>
      </p>
    </div>
  );
}
