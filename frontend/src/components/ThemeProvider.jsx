// beacon2/frontend/src/components/ThemeProvider.jsx
// Applies user display preferences (text size, colour theme) to main content.
// Reads from localStorage preferences; re-applies on storage events.

import { useState, useEffect, useCallback } from 'react';
import { getPreferences } from '../hooks/usePreferences.js';

const PREFS_KEY = 'beacon2_prefs';

/**
 * Wraps page content and applies data-theme / data-text-size attributes
 * so CSS rules in index.css can style the content area accordingly.
 * NavBar and PageHeader sit outside this wrapper and are unaffected.
 */
export default function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(getPreferences);

  const refresh = useCallback(() => setPrefs(getPreferences()), []);

  useEffect(() => {
    // Re-read when another tab changes preferences
    function onStorage(e) {
      if (e.key === PREFS_KEY) refresh();
    }
    window.addEventListener('storage', onStorage);
    // Also listen for a custom event so same-tab saves are picked up
    window.addEventListener('beacon2-prefs-changed', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beacon2-prefs-changed', refresh);
    };
  }, [refresh]);

  return (
    <div
      data-theme={prefs.colorTheme || 'default'}
      data-text-size={prefs.textSize || 'normal'}
      className="beacon-themed-content"
    >
      {children}
    </div>
  );
}
