// beacon2/frontend/src/hooks/useUnsavedChanges.js

import { useContext, useEffect, useRef, useState } from 'react';
import { useBlocker, UNSAFE_DataRouterContext as DataRouterContext } from 'react-router-dom';

/**
 * Warns the user before leaving a page with unsaved changes.
 *
 * Uses React Router's useBlocker (data router) to intercept in-app navigation.
 * Falls back to beforeunload-only when not inside a data router (e.g. tests
 * using MemoryRouter).
 *
 * Returns { markDirty, markClean }:
 *   - markDirty()  — call whenever a form field changes
 *   - markClean()  — call when saved or the form is reset
 *
 * IMPORTANT: call markClean() BEFORE navigate() in save handlers so that
 * programmatic navigation is not blocked by the dirty guard.
 */
export function useUnsavedChanges() {
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

  // Detect whether we are inside a data router (createBrowserRouter /
  // createMemoryRouter).  The context is stable for the lifetime of the
  // component, so the conditional hook call below will always follow
  // the same branch — the rules-of-hooks invariant is satisfied.
  const hasDataRouter = !!useContext(DataRouterContext);

  if (hasDataRouter) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const blocker = useBlocker(() => isDirtyRef.current);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (blocker.state === 'blocked') {
        if (window.confirm('You have unsaved changes. Leave this page and discard them?')) {
          blocker.proceed();
        } else {
          blocker.reset();
        }
      }
    }, [blocker]);
  }

  // Browser-level navigation (refresh, close tab, browser back to external site)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return { markDirty, markClean };
}
