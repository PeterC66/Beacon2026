// beacon2/frontend/src/context/AuthContext.jsx
// Provides authentication state and actions to the whole app.

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth as authApi, settings as settingsApi, setAuth, clearAuth, restoreSession } from '../lib/api.js';
import { getPreferences } from '../hooks/usePreferences.js';
import { hasOptionalCookieConsent } from '../hooks/useCookieConsent.js';

const AuthContext = createContext(null);

// Sub-feature → master-toggle dependency map.
// When a master toggle is off, all its dependents are treated as off too.
const FEATURE_DEPS = {
  teams: 'groups', venues: 'groups', faculties: 'groups',
  groupLedger: 'groups', siteworks: 'groups',
  calendar: 'events', eventTypes: 'events',
  creditBatches: 'finance', reconciliation: 'finance',
  financialStatement: 'finance', groupsStatement: 'finance',
  transferMoney: 'finance',
};

// Features that default to OFF when the key is missing from feature_config.
// All other features default to ON (opt-out model).
const FEATURE_DEFAULTS_OFF = new Set(['giftAid', 'groupLedger', 'siteworks']);

/** Is a single feature key on, considering its default? */
function isOn(config, key) {
  if (key in config) return config[key] !== false;
  return !FEATURE_DEFAULTS_OFF.has(key);
}

// Read the beacon_last_u3a cookie (set on successful login by Login.jsx)
function getLastU3aCookie() {
  if (!hasOptionalCookieConsent()) return '';
  const match = document.cookie.split('; ').find((c) => c.startsWith('beacon_last_u3a='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // { id, name, email }
  const [tenant,  setTenant]  = useState(null);   // slug string
  const [privs,   setPrivs]   = useState([]);     // string[] of "resource:action"
  const [siteAdmin, setSiteAdmin] = useState(false); // true for site administrator
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [featureConfig, setFeatureConfig] = useState({}); // feature toggles from tenant_settings
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [restoring, setRestoring] = useState(true); // true while checking refresh cookie

  // ── Session restoration on mount ──────────────────────────────────────
  useEffect(() => {
    const slug = getLastU3aCookie();
    if (!slug) { setRestoring(false); return; }
    restoreSession(slug).then(async (data) => {
      if (data) {
        const payload = parseJwt(data.accessToken);
        setUser(data.user);
        setTenant(slug);
        setPrivs(payload.privileges ?? []);
        setSiteAdmin(payload.isSiteAdmin || false);
        setMustChangePassword(data.mustChangePassword || false);
        try { setFeatureConfig(await settingsApi.getFeatureConfig()); } catch {}
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
      setSiteAdmin(false);
      setMustChangePassword(false);
      setFeatureConfig({});
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
      setSiteAdmin(payload.isSiteAdmin || false);
      setMustChangePassword(data.mustChangePassword || false);
      try { setFeatureConfig(await settingsApi.getFeatureConfig()); } catch {}
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
    setSiteAdmin(false);
    setMustChangePassword(false);
    setFeatureConfig({});
  }, []);

  /**
   * Check if the current user has a specific privilege.
   * @param {string} resource  e.g. 'role_record'
   * @param {string} action    e.g. 'view'
   */
  const can = useCallback((resource, action) => {
    if (siteAdmin) return true;
    return privs.includes(`${resource}:${action}`);
  }, [privs, siteAdmin]);

  /**
   * Check if a feature toggle is enabled for this tenant.
   * Most missing keys default to true (opt-out model), but features in
   * FEATURE_DEFAULTS_OFF default to false when never explicitly set.
   * Also checks parent dependency — e.g. if 'events' is off, 'calendar' is off too.
   * @param {string} key  e.g. 'finance', 'giftAid'
   */
  const hasFeature = useCallback((key) => {
    if (!isOn(featureConfig, key)) return false;
    const parent = FEATURE_DEPS[key];
    if (parent && !isOn(featureConfig, parent)) return false;
    return true;
  }, [featureConfig]);

  /** Re-fetch feature config from backend (call after updating toggles). */
  const refreshFeatureConfig = useCallback(async () => {
    try { setFeatureConfig(await settingsApi.getFeatureConfig()); } catch {}
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  // While restoring session from refresh cookie, render nothing to avoid
  // flashing the login page before auth state is known.
  if (restoring) return null;

  return (
    <AuthContext.Provider value={{ user, tenant, privs, loading, error, login, logout, can, hasFeature, featureConfig, refreshFeatureConfig, isLoggedIn: !!user, isSiteAdmin: siteAdmin, mustChangePassword, clearMustChangePassword }}>
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
