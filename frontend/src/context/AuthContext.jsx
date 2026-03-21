// beacon2/frontend/src/context/AuthContext.jsx
// Provides authentication state and actions to the whole app.

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth as authApi, setAuth, clearAuth, restoreSession } from '../lib/api.js';
import { getPreferences } from '../hooks/usePreferences.js';

const AuthContext = createContext(null);

// Read the beacon_last_u3a cookie (set on successful login by Login.jsx)
function getLastU3aCookie() {
  const match = document.cookie.split('; ').find((c) => c.startsWith('beacon_last_u3a='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // { id, name, email }
  const [tenant,  setTenant]  = useState(null);   // slug string
  const [privs,   setPrivs]   = useState([]);     // string[] of "resource:action"
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [restoring, setRestoring] = useState(true); // true while checking refresh cookie

  // ── Session restoration on mount ──────────────────────────────────────
  useEffect(() => {
    const slug = getLastU3aCookie();
    if (!slug) { setRestoring(false); return; }
    restoreSession(slug).then((data) => {
      if (data) {
        const payload = parseJwt(data.accessToken);
        setUser(data.user);
        setTenant(slug);
        setPrivs(payload.privileges ?? []);
      }
    }).finally(() => setRestoring(false));
  }, []);

  // ── Inactivity timeout ────────────────────────────────────────────────
  const inactivityTimer = useRef(null);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    const minutes = getPreferences().inactivityTimeout;
    inactivityTimer.current = setTimeout(() => {
      // Fire auth:expired to trigger logout
      window.dispatchEvent(new Event('auth:expired'));
    }, minutes * 60 * 1000);
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // Listen for auth:expired events fired by the API client or inactivity timer
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setTenant(null);
      setPrivs([]);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const login = useCallback(async (tenantSlug, username, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(tenantSlug, username, password);
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

  // While restoring session from refresh cookie, render nothing to avoid
  // flashing the login page before auth state is known.
  if (restoring) return null;

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
