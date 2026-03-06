// beacon2/frontend/src/context/AuthContext.jsx
// Provides authentication state and actions to the whole app.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, setAuth, clearAuth } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // { id, name, email }
  const [tenant,  setTenant]  = useState(null);   // slug string
  const [privs,   setPrivs]   = useState([]);     // string[] of "resource:action"
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Listen for auth:expired events fired by the API client
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setTenant(null);
      setPrivs([]);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback(async (tenantSlug, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(tenantSlug, email, password);
      setAuth(data.accessToken, tenantSlug);

      // Decode the JWT payload to extract privileges
      const payload = parseJwt(data.accessToken);
      setUser(data.user);
      setTenant(tenantSlug);
      setPrivs(payload.privileges ?? []);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    setUser(null);
    setTenant(null);
    setPrivs([]);
  }, []);

  /**
   * Check if the current user has a specific privilege.
   * @param {string} resource  e.g. 'role_record'
   * @param {string} action    e.g. 'view'
   */
  const can = useCallback((resource, action) => {
    return privs.includes(`${resource}:${action}`);
  }, [privs]);

  return (
    <AuthContext.Provider value={{ user, tenant, privs, loading, error, login, logout, can, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Decode a JWT payload without verifying (verification happens server-side)
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}
