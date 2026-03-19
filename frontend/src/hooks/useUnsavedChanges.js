// beacon2/frontend/src/hooks/useUnsavedChanges.js

import { useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';

/**
 * Warns the user before leaving a page with unsaved changes.
 *
 * Uses the internal UNSAFE_NavigationContext to intercept React Router
 * in-app navigation (works with BrowserRouter, not just data routers).
 * Also installs a beforeunload handler for browser-level navigation.
 *
 * Returns { markDirty, markClean }:
 *   - markDirty()  — call whenever a form field changes
 *   - markClean()  — call when saved or the form is reset
 *
 * IMPORTANT: call markClean() BEFORE navigate() in save handlers so that
 * programmatic navigation is not blocked by the dirty guard.
 */
export function useUnsavedChanges() {
  // isDirtyRef is updated synchronously; isDirty state drives the effect lifecycle
  const isDirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);

  function markDirty() {
    isDirtyRef.current = true;
    setIsDirty(true);
  }

  function markClean() {
    isDirtyRef.current = false;
    setIsDirty(false);
  }

  // In-app navigation blocker via UNSAFE_NavigationContext
  const navCtx = useContext(NavigationContext);
  const navigator = navCtx?.navigator;

  useEffect(() => {
    if (!isDirty || typeof navigator?.block !== 'function') return;

    const unblock = navigator.block((tx) => {
      // Check ref (updated synchronously by markClean) rather than the
      // stale isDirty closure — allows save handlers to markClean() then
      // navigate() without triggering the dialog.
      if (!isDirtyRef.current) {
        unblock();
        tx.retry();
        return;
      }
      if (window.confirm('You have unsaved changes. Leave this page and discard them?')) {
        unblock();
        tx.retry();
      }
      // else: navigation is cancelled (user clicked Cancel)
    });

    return unblock;
  }, [navigator, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser-level navigation (refresh, close tab, browser back to external site)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return { markDirty, markClean };
}
